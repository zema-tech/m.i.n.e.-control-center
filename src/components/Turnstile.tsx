import { useEffect, useRef, type MutableRefObject } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        opts: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          callback?: (token: string) => void;
          ["error-callback"]?: () => void;
          ["expired-callback"]?: () => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript(): Promise<void> {
  if (typeof document === "undefined") return Promise.reject(new Error("no document"));
  if (window.turnstile) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("turnstile load")), {
        once: true,
      });
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.addEventListener("load", () => resolve(), { once: true });
    s.addEventListener("error", () => reject(new Error("turnstile load")), { once: true });
    document.head.appendChild(s);
  });
}

export type TurnstileHandle = { reset: () => void };

export function Turnstile({
  siteKey,
  onToken,
  onExpire,
  handleRef,
}: {
  siteKey: string;
  onToken: (token: string) => void;
  onExpire?: () => void;
  handleRef?: MutableRefObject<TurnstileHandle | null>;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef(onToken);
  tokenRef.current = onToken;
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  useEffect(() => {
    let widgetId: string | null = null;
    let cancelled = false;
    void loadScript()
      .then(() => {
        if (cancelled || !boxRef.current || !window.turnstile) return;
        widgetId = window.turnstile.render(boxRef.current, {
          sitekey: siteKey,
          theme: "dark",
          callback: (token: string) => tokenRef.current(token),
          "expired-callback": () => {
            tokenRef.current("");
            expireRef.current?.();
          },
          "error-callback": () => tokenRef.current(""),
        });
      })
      .catch(() => {
        /* widget non disponibile: il server decide (fail-open se non configurato) */
      });
    if (handleRef) {
      handleRef.current = {
        reset: () => {
          try {
            window.turnstile?.reset(widgetId ?? undefined);
          } catch {
            /* ignore */
          }
          tokenRef.current("");
        },
      };
    }
    return () => {
      cancelled = true;
      try {
        if (widgetId) window.turnstile?.remove(widgetId);
      } catch {
        /* ignore */
      }
      if (handleRef) handleRef.current = null;
    };
  }, [siteKey, handleRef]);

  return <div ref={boxRef} className="flex justify-center" />;
}
