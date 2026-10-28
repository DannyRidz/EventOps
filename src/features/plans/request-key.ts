// Keep only an operation key in tab scoped session storage, never plan content or text.
// A lost commit response can then be retried after a reload in the same tab.
export function operationKey(operation: string): string {
  if (typeof window === "undefined") return crypto.randomUUID();
  try {
    const name = `eventops:request:${operation}`;
    const existing = window.sessionStorage.getItem(name);
    if (existing && /^[0-9a-f-]{36}$/.test(existing)) return existing;
    const key = crypto.randomUUID();
    window.sessionStorage.setItem(name, key);
    return key;
  } catch {
    // Storage can be disabled. The receipt and official revision remain durable on the server.
    return crypto.randomUUID();
  }
}
