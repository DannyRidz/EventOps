"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  MAX_AUDIO_BYTES,
  MAX_AUDIO_SECONDS,
  recordingTypes,
  type VoiceJob,
} from "./contracts";
export function VoiceRecorder({
  eventId,
  enabled = false,
  jobs = [],
}: {
  eventId: string;
  enabled?: boolean;
  jobs?: VoiceJob[];
}) {
  const router = useRouter();
  const [recording, setRecording] = useState(false),
    [opening, setOpening] = useState(false),
    [blob, setBlob] = useState<Blob | null>(null),
    [url, setUrl] = useState(""),
    [seconds, setSeconds] = useState(0),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setInterval> | null>(null),
    key = useRef(crypto.randomUUID()),
    alive = useRef(true),
    localUrl = useRef(""),
    discarded = useRef(false);
  const active = jobs.some((j) =>
    ["uploading", "queued", "running"].includes(j.state),
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
      if (localUrl.current) URL.revokeObjectURL(localUrl.current);
    };
  }, []);
  useEffect(() => {
    if (!blob && !recording) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [blob, recording]);
  useEffect(() => {
    if (!active) return;
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 2000);
    return () => clearInterval(poll);
  }, [active, router]);
  function replaceRecording(value: Blob | null) {
    if (localUrl.current) URL.revokeObjectURL(localUrl.current);
    localUrl.current = value ? URL.createObjectURL(value) : "";
    setBlob(value);
    setUrl(localUrl.current);
  }
  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    if (timer.current) clearInterval(timer.current);
    setRecording(false);
  }
  async function start() {
    setError("");
    setOpening(true);
    discarded.current = false;
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "Recording is unavailable in this browser. Type your update below.",
        );
      const mime = recordingTypes.find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      if (!mime)
        throw new Error(
          "This browser cannot record a supported format. Type your update below.",
        );
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const capture = new MediaRecorder(media, { mimeType: mime });
      recorder.current = capture;
      const chunks: Blob[] = [];
      let size = 0;
      let oversized = false;
      const started = Date.now();
      capture.ondataavailable = (e) => {
        if (e.data.size) {
          size += e.data.size;
          if (size > MAX_AUDIO_BYTES) {
            oversized = true;
            stop();
            setError(
              "The recording exceeded 10 MiB. Record a shorter update or type it.",
            );
          } else chunks.push(e.data);
        }
      };
      capture.onerror = () => {
        stop();
        setError(
          "Recording stopped unexpectedly. Type your update or record again.",
        );
      };
      capture.onstop = () => {
        media.getTracks().forEach((t) => t.stop());
        if (timer.current) clearInterval(timer.current);
        if (alive.current) {
          setRecording(false);
          if (!oversized && !discarded.current) {
            if (!size) {
              setError(
                "No audio was captured. Record again or type your update below.",
              );
              return;
            }
            replaceRecording(new Blob(chunks, { type: capture.mimeType }));
            key.current = crypto.randomUUID();
          }
        }
      };
      capture.start(250);
      setRecording(true);
      setSeconds(0);
      replaceRecording(null);
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - started) / 1000);
        setSeconds(Math.min(elapsed, MAX_AUDIO_SECONDS));
        if (elapsed >= MAX_AUDIO_SECONDS) stop();
      }, 200);
    } catch {
      stream.current?.getTracks().forEach((t) => t.stop());
      setError(
        "Microphone access or a supported recording format is unavailable. You can type the complete update below.",
      );
    } finally {
      setOpening(false);
    }
  }
  async function upload() {
    if (!blob) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/events/${eventId}/voice`, {
        method: "POST",
        headers: { "Content-Type": blob.type, "Idempotency-Key": key.current },
        body: blob,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message ?? "Could not save the recording.");
      replaceRecording(null);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Transcription is unavailable. Keep your recording or type below.",
      );
    } finally {
      setPending(false);
    }
  }
  async function retrySaved(id: string) {
    setError("");
    try {
      const response = await fetch(`/api/events/${eventId}/voice/${id}`, {
        method: "POST",
      });
      if (!response.ok)
        throw new Error(
          "The uploaded audio is incomplete. Retry with the local recording, or discard this upload and record again.",
        );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not retry the upload.");
    }
  }
  async function remove(id: string) {
    setError("");
    try {
      const response = await fetch(`/api/events/${eventId}/voice/${id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok || !result.audio_deleted)
        throw new Error(
          result.message ?? "Audio deletion is pending. Retry deletion.",
        );
      router.refresh();
    } catch {
      setError(
        "Audio deletion could not complete. Retry deletion. Your saved text is unchanged.",
      );
    }
  }
  return (
    <section className="stack" aria-labelledby="voice-heading">
      <h2 id="voice-heading">Record an update</h2>
      <p>
        Up to 120 seconds and 10 MiB, using WebM with Opus or MP4 with AAC.
        Uploaded audio, including spoken names, is processed by Meta for
        transcription. Review and correct the transcript before confirming it.
        Recording does not change your approved plan.
      </p>
      <p>
        Uploaded audio is deleted after text confirmation or discard, otherwise
        within 24 hours of transcription finishing, and no later than seven days
        after upload. Typing is always available below.
      </p>
      {!enabled && (
        <p role="status">
          Transcription is unavailable. You can record and play back locally, or
          type your update. Audio is not uploaded while transcription is
          unavailable.
        </p>
      )}
      <div className="button-row">
        {recording ? (
          <Button onClick={stop}>Stop recording</Button>
        ) : (
          <Button onClick={start} disabled={opening || pending || active}>
            {opening ? "Opening microphone…" : "Start recording"}
          </Button>
        )}
        {(blob || recording) && (
          <Button
            disabled={pending}
            onClick={() => {
              discarded.current = true;
              stop();
              replaceRecording(null);
              setUrl("");
            }}
          >
            Discard local recording
          </Button>
        )}
      </div>
      {recording && <p role="status">Recording, {seconds} of 120 seconds.</p>}
      {blob && (
        <>
          <audio controls src={url} aria-label="Play your recording" />
          <Button
            disabled={
              !enabled ||
              pending ||
              jobs.some((j) => ["queued", "running"].includes(j.state)) ||
              !blob.size
            }
            onClick={upload}
          >
            {pending ? "Saving recording…" : "Save recording for transcription"}
          </Button>
          <p>
            Playback is local until you save the recording. Keep this page open
            to retain an unsaved recording.
          </p>
        </>
      )}
      {jobs.map((job) => (
        <div className="state-panel stack" key={job.id}>
          <p role="status">
            {job.state === "completed"
              ? "Transcript saved. Review the exact text before analysis."
              : job.state === "failed"
                ? "Transcription failed. Your text updates are safe. Record again or type below."
                : job.state === "discarded"
                  ? "Recording discarded."
                  : job.state === "uploading"
                    ? "Recording upload is incomplete. Retry the same upload or discard it."
                    : "Recording saved. Transcription is " +
                      job.state +
                      ". You can return to this page later."}
          </p>
          {job.state === "uploading" && (
            <Button onClick={() => retrySaved(job.id)}>
              Retry saved upload
            </Button>
          )}
          {job.draft_id && (
            <Link href={`/events/${eventId}/updates/${job.draft_id}`}>
              Review saved transcript
            </Link>
          )}
          {!job.audio_deleted_at && (
            <audio
              controls
              preload="none"
              src={`/api/events/${eventId}/voice/${job.id}/audio`}
              aria-label="Play saved recording"
            />
          )}
          {!job.audio_deleted_at && (
            <Button onClick={() => remove(job.id)}>
              {job.state === "completed" ? "Delete audio" : "Discard recording"}
            </Button>
          )}
        </div>
      ))}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </section>
  );
}
