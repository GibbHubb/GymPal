// G58 — read the user id out of an access token, without verifying it.
//
// The client never trusts this for security (the server verifies every token); it only
// answers "whose token is this", so the offline queue can be matched to the user the server
// will attribute a sync to. Reading it from the token rather than a stored `user_id` key
// matters: sessions from before G47 never stored user_id (login read it from the wrong
// place), and with refresh those sessions now live on without a fresh login.

function base64UrlDecode(part) {
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return atob(padded); // global in Hermes (RN >= 0.74) and in Node >= 16
}

/** The token's `user_id` claim as a string, or null if the token is absent or unreadable. */
export function tokenUserId(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const claims = JSON.parse(base64UrlDecode(parts[1]));
    const id = claims && claims.user_id;
    return id === undefined || id === null ? null : String(id);
  } catch {
    return null;
  }
}
