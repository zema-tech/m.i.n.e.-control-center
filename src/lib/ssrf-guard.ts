/**
 * Guardia SSRF — condivisa client/server (no Node deps).
 * Blocca URL verso rete interna / localhost / metadata cloud.
 */

const BLOCKED_HOST_RE =
  /^(localhost|0\.0\.0\.0|::1|::ffff:.*|169\.254\.\d+\.\d+|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)$/i;

const BLOCKED_SUFFIX_RE = /\.(local|internal|lan|home|corp|intranet)$/i;

export function isBlockedHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!h) return true;
  if (BLOCKED_HOST_RE.test(h)) return true;
  if (BLOCKED_SUFFIX_RE.test(h)) return true;
  // Nomi senza punto (es. "localhost", "metadata") non sono host pubblici
  if (!h.includes(".") && h !== "localhost") return true;
  return false;
}

/** Lancia se l'URL non è https pubblico. Ritorna l'URL normalizzato. */
export function assertPublicHttpsUrl(raw: string, label = "URL"): string {
  const value = raw.trim();
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    throw new Error(`${label} non valido.`);
  }
  if (u.protocol !== "https:") {
    throw new Error(`${label} non consentito (solo https pubblico).`);
  }
  if (isBlockedHostname(u.hostname)) {
    throw new Error(`${label} non consentito (host interno).`);
  }
  return u.toString();
}
