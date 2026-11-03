// Synthetic local voice worker verification, with actual ASR only when authorized.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { campaignCall } from "./t9-allowance.mjs";

export async function verifyLiveVoice({
  admin,
  db,
  one,
  event,
  base,
  login,
  databaseName,
  databaseUrl,
  folder,
  attempt,
  controlled,
  clearSpeech,
  report,
  save,
}) {
  const { voiceEnabled } =
    await import("../../src/features/voice/contracts.ts");
  const { runVoice, cleanupVoice } =
    await import("../../src/features/voice/worker.ts");
  const { createTranscriber } =
    await import("../../src/features/voice/provider.ts");
  const { wavDuration } =
    await import("../../src/features/voice/conversion.ts");
  assert.ok(voiceEnabled(), "Temporary voice verification gates required");
  assert.ok(process.env.EVENTOPS_FFMPEG_PATH);
  const manifest = JSON.parse(
    await readFile(
      clearSpeech
        ? "evals/t9/audio/live-smoke.json"
        : "evals/t9/audio/manifest.json",
      "utf8",
    ),
  );
  const file = manifest.files.find(
    (f) => f.file === (clearSpeech ? "speech-samantha.webm" : "speech.webm"),
  );
  const bytes = await readFile(resolve("evals/t9/audio", file.file));
  assert.equal(bytes.length, file.bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256);
  await db.query("update eventops_private.voice_gate set enabled=true");
  const job = await one("select public.begin_voice($1,$2,$3,$4,$5) value", [
    event,
    randomUUID(),
    file.sha256,
    bytes.length,
    file.mime,
  ]);
  // Local fixture store, not a claim of hosted Storage or JWT verification.
  await db.query(
    "insert into storage.objects(bucket_id,name) values('event-audio',$1)",
    [job.object_key],
  );
  await one("select public.queue_voice($1,$2) value", [event, job.id]);
  const password = randomUUID();
  await admin.query(
    `create role ${login} login noinherit password '${password}';grant eventops_worker to ${login}`,
  );
  const url = new URL(databaseUrl);
  url.pathname = "/" + databaseName;
  url.username = login;
  url.password = password;
  const worker = new pg.Client({ connectionString: url.href });
  await worker.connect();
  let removed = false;
  try {
    await worker.query("set role eventops_worker");
    await worker.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ role: "eventops_worker" }),
    ]);
    const store = {
      async read(path) {
        assert.equal(path, job.object_key);
        assert.equal(removed, false);
        return bytes;
      },
      async remove(path) {
        assert.equal(path, job.object_key);
        // Delete using restricted Storage row policy, not owner table access.
        const deletion = await worker.query(
          "delete from storage.objects where bucket_id='event-audio' and name=$1",
          [path],
        );
        assert.equal(deletion.rowCount, 1, "Restricted fixture audio deletion");
        removed = true;
      },
    };
    let calls = 0;
    const guardedFetch = async (endpoint, options) => {
      assert.equal(endpoint, "https://api.meta.ai/v1/asr/transcribe");
      assert.equal(++calls, 1, "One ASR request per attempt");
      const settings = JSON.parse(await options.body.get("request").text());
      assert.equal(settings.model, "muse-voice-transcribe-1.0");
      assert.equal(settings.mode, "PUSH_TO_TALK");
      assert.equal(settings.audioEncoding, "WAV");
      const wav = Buffer.from(await options.body.get("audio").arrayBuffer());
      const duration = wavDuration(wav);
      assert.ok(duration <= 120000);
      return campaignCall(
        {
          path: resolve(
            folder,
            controlled
              ? "controlled-reservations.jsonl"
              : "usd1-reservations.jsonl",
          ),
          limitMicrousd: 1000000,
          amountMicrousd: 6000,
          key: `${attempt}-voice-call-1`,
        },
        async () => {
          const receipt = {
            key: `${attempt}-voice-call-1`,
            reserved_usd: 0.006,
            duration_ms: duration,
          };
          report.requests.push(receipt);
          await save();
          const started = Date.now();
          let response;
          try {
            response = controlled
              ? Response.json({ transcript: file.authored_transcript })
              : await fetch(endpoint, options);
          } catch (e) {
            receipt.transport_error = { name: e.name, code: e.cause?.code };
            receipt.latency_ms = Date.now() - started;
            await save();
            throw e;
          }
          receipt.status = response.status;
          receipt.latency_ms = Date.now() - started;
          receipt.request_id = response.headers.get("x-request-id");
          if (!response.ok) {
            try {
              receipt.provider_error = (await response.clone().json()).error;
            } catch {
              /* Shape is untrusted. */
            }
          }
          await save();
          return response;
        },
      )();
    };
    assert.equal(
      await runVoice(
        worker,
        store,
        createTranscriber(process.env.MODEL_API_KEY, guardedFetch),
        process.env.EVENTOPS_FFMPEG_PATH,
      ),
      true,
    );
    const finished = (
      await db.query(
        "select state,draft_id,duration_ms,error_code from public.voice_jobs where id=$1",
        [job.id],
      )
    ).rows[0];
    report.voice_worker = finished;
    await save();
    assert.equal(finished.state, "completed", JSON.stringify(finished));
    const draft = await one(
      "select to_jsonb(d) value from public.text_update_drafts d where id=$1",
      [finished.draft_id],
    );
    report.voice_transcript = draft.raw_text;
    report.voice_authored_transcript = file.authored_transcript;
    await save();
    const normalized = draft.raw_text.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
    assert.ok(
      normalized.includes("opening") && /room\s+(2|two)/.test(normalized),
    );
    assert.ok(
      /(twelve|12)/.test(normalized) && /(thirteen|13)/.test(normalized),
    );
    assert.ok(normalized.includes("sam"));
    const corrected =
      "Move Opening to Room 2 from 12:00 to 13:00. Synthetic Sam will cover Opening.";
    const edited = await one(
      "select public.save_text_update($1,$2,$3,$4,$5,$6) value",
      [
        event,
        draft.raw_text,
        corrected,
        randomUUID(),
        draft.id,
        draft.generation,
      ],
    );
    assert.equal(edited.raw_text, draft.raw_text);
    const confirmed = await one(
      "select public.confirm_text_analysis($1,$2,$3,$4,$5,true) value",
      [event, edited.id, edited.generation, base.revision_id, corrected],
    );
    assert.equal(confirmed.state, "blocked");
    const original = (
      await db.query(
        "select value_json from public.source_records where record_id=$1 and field_path='original_transcript'",
        [draft.id],
      )
    ).rows;
    assert.equal(original.length, 1);
    assert.equal(original[0].value_json, draft.raw_text);
    await one("select public.discard_voice($1,$2) value", [event, job.id]);
    await cleanupVoice(worker, store);
    assert.equal(removed, true);
    const deleted = (
      await db.query(
        "select audio_deleted_at is not null deleted from public.voice_jobs where id=$1",
        [job.id],
      )
    ).rows[0].deleted;
    assert.equal(
      deleted,
      true,
      "Audio deletion acknowledged only after metadata is absent",
    );
    return {
      live_provider: !controlled,
      storage:
        "synthetic local fixture store with restricted SQL deletion policy",
      transcript: draft.raw_text,
      authored_transcript: file.authored_transcript,
      duration_ms: finished.duration_ms,
      estimated_duration_cost_usd: (finished.duration_ms * 0.18) / 3600000,
      sql_reservation_usd: 0.018,
      semantic_words_verified: true,
      original_preserved: true,
      corrected_text_confirmed: true,
      analysis_remains_blocked: true,
      audio_cleanup_acknowledged: true,
    };
  } finally {
    await worker.end();
  }
}
