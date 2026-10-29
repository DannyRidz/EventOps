// A new document discards routes prefetched before the session cookie changed.
export function navigateAccount(destination: "/events" | "/sign-in") {
  window.location.assign(destination);
}
