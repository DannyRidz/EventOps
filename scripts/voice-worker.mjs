import "./register-app-modules.mjs";
const { startVoiceWorker } = await import("../src/features/voice/worker.ts");
try {
  await startVoiceWorker();
} catch {
  console.error(JSON.stringify({ error_code: "VOICE_CONFIGURATION_REQUIRED" }));
  process.exitCode = 1;
}
