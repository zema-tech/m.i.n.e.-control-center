/** Policy password — condivisa client/server (no Node deps). */

export const PASSWORD_MIN_LENGTH = 10;

const COMMON = new Set(
  [
    "password",
    "password1",
    "password123",
    "123456",
    "12345678",
    "123456789",
    "qwerty",
    "qwerty123",
    "admin",
    "admin123",
    "letmein",
    "welcome",
    "omnicore",
    "jarvis",
    "minecontrol",
    "minecraft",
    "falixnodes",
  ].map((s) => s.toLowerCase()),
);

export type PasswordChecks = {
  length: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
  symbol: boolean;
};

export function getPasswordChecks(password: string): PasswordChecks {
  return {
    length: password.length >= PASSWORD_MIN_LENGTH,
    upper: /[A-ZÀ-Þ]/.test(password),
    lower: /[a-zà-þ]/.test(password),
    digit: /\d/.test(password),
    symbol: /[^A-Za-z0-9à-þÀ-Þ]/.test(password),
  };
}

/** 0-4: 0 pessima, 4 forte. */
export function passwordScore(password: string): number {
  if (!password) return 0;
  if (COMMON.has(password.toLowerCase())) return 0;
  const c = getPasswordChecks(password);
  let score = 0;
  if (c.length) score += 1;
  // Categorie: servono almeno 3 su 4 per andare oltre 2
  const categories = [c.upper, c.lower, c.digit, c.symbol].filter(Boolean).length;
  if (categories >= 2) score += 1;
  if (categories >= 3 && password.length >= 12) score += 1;
  if (categories === 4 && password.length >= 14) score += 1;
  // Penalità pattern banali
  if (/(.)\1{3,}/.test(password)) score = Math.max(0, score - 1);
  if (/^(123+|abc+|qwerty+)/i.test(password)) score = Math.max(0, score - 1);
  return Math.min(4, Math.max(0, score));
}

export function passwordScoreLabel(score: number): string {
  switch (score) {
    case 0:
      return "Molto debole";
    case 1:
      return "Debole";
    case 2:
      return "Media";
    case 3:
      return "Forte";
    case 4:
      return "Ottima";
    default:
      return "";
  }
}

export function validateNewPassword(password: string): { ok: boolean; message: string } {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, message: `Minimo ${PASSWORD_MIN_LENGTH} caratteri.` };
  }
  if (password.length > 200) {
    return { ok: false, message: "Password troppo lunga (max 200)." };
  }
  if (COMMON.has(password.toLowerCase())) {
    return { ok: false, message: "Password troppo comune, scegline un'altra." };
  }
  const c = getPasswordChecks(password);
  const categories = [c.upper, c.lower, c.digit, c.symbol].filter(Boolean).length;
  if (categories < 3) {
    return {
      ok: false,
      message: "Usa almeno 3 tra: maiuscole, minuscole, numeri, simboli.",
    };
  }
  if (/(.)\1{4,}/.test(password)) {
    return { ok: false, message: "Evita lunghe ripetizioni dello stesso carattere." };
  }
  return { ok: true, message: "Password ok." };
}
