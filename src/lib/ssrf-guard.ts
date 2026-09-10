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

/**
 * Riconosce letterali IP numerici non decimali-puntati (bypass del regex):
 * decimali puri (2130706433), esadecimali (0x7f000001, 0x7f.0.0.1),
 * ottali (0177.0.0.1) e forme corte (127.1). Fail-closed: mai host pubblici.
 */
function isNumericIpLiteral(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!h || h.includes(":") || /[g-z]/.test(h)) return false;
  if (!/^[0-9a-fx.]+$/.test(h)) return false;
  if (/^0x[0-9a-f]+$/.test(h) || /^\d+$/.test(h)) return true;
  const parts = h.split(".");
  if (parts.length < 2 || parts.length > 4) return false;
  return parts.every((p) => /^(0x[0-9a-f]+|0[0-7]*|\d+)$/.test(p));
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
  // VibeSec: userinfo e porte non standard non hanno uso legittimo qui.
  if (u.username || u.password) {
    throw new Error(`${label} non consentito (userinfo).`);
  }
  if (u.port && u.port !== "443") {
    throw new Error(`${label} non consentito (porta).`);
  }
  if (isBlockedHostname(u.hostname) || isNumericIpLiteral(u.hostname)) {
    throw new Error(`${label} non consentito (host interno).`);
  }
  return u.toString();
}
