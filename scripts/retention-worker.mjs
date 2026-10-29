import "./register-app-modules.mjs";
try {
  const { startMaintenance } =
    await import("../src/features/privacy/maintenance.ts");
  await startMaintenance();
} catch {
  console.error(JSON.stringify({ code: "RETENTION_CONFIGURATION_REQUIRED" }));
  process.exitCode = 1;
}
