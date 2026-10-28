import "./register-app-modules.mjs";
const { startWorker } = await import("../src/features/analysis/worker.ts");
try {
  await startWorker();
} catch {
  console.error(
    JSON.stringify({ error_code: "WORKER_CONFIGURATION_REQUIRED" }),
  );
  process.exitCode = 1;
}
