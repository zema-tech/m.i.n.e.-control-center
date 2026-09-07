import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  Clock,
  Coffee,
  Copy,
  Gamepad2,
  Heart,
  KeyRound,
  Plus,
  Shield,
  Sparkles,
  Star,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState, type ComponentType } from "react";

import { AppShell } from "@/components/AppShell";
import {
  createGuestPassword,
  getAuthState,
  getGuestPasswords,
  revokeGuestPassword,
} from "@/lib/auth.functions";
import {
  ALL_PERMISSIONS,
  DEFAULT_GUEST_PERMISSIONS,
  PERMISSION_META,
  type Permission,
} from "@/lib/auth.server";

export const Route = createFileRoute("/access")({
  head: () => ({
    meta: [
      { title: "Accesso — Omnicore" },
      { name: "description", content: "Password temporanee e permessi per ospiti." },
    ],
  }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    if (state.mustSetPassword) throw redirect({ to: "/setup-password" });
    if (state.role !== "admin") throw redirect({ to: "/home" });
    return null;
  },
  component: AccessPage,
});

type TempIcon =
  | "none"
  | "key"
  | "user"
  | "users"
  | "star"
  | "shield"
  | "coffee"
  | "gamepad"
  | "sparkles"
  | "heart";

type GuestItem = {
  id: string;
  label: string;
  icon: TempIcon;
  createdAt: number;
  expiresAt: number;
  uses: number;
  maxUses: number | null;
  expired: boolean;
  permissions: Permission[];
};

const DURATIONS = [
  { hours: 1 as const, label: "1 ora" },
  { hours: 6 as const, label: "6 ore" },
  { hours: 24 as const, label: "24 ore" },
  { hours: 168 as const, label: "7 giorni" },
];

const ICON_OPTIONS: {
  id: TempIcon;
  label: string;
  Icon: ComponentType<{ className?: string }> | null;
}[] = [
  { id: "none", label: "Nessuna", Icon: null },
  { id: "key", label: "Chiave", Icon: KeyRound },
  { id: "user", label: "Utente", Icon: User },
  { id: "users", label: "Team", Icon: Users },
  { id: "star", label: "Stella", Icon: Star },
  { id: "shield", label: "Scudo", Icon: Shield },
  { id: "coffee", label: "Caffè", Icon: Coffee },
  { id: "gamepad", label: "Game", Icon: Gamepad2 },
  { id: "sparkles", label: "Spark", Icon: Sparkles },
  { id: "heart", label: "Cuore", Icon: Heart },
];

function IconBadge({ icon, className = "h-4 w-4" }: { icon: TempIcon; className?: string }) {
  const opt = ICON_OPTIONS.find((o) => o.id === icon);
  if (!opt?.Icon) return null;
  const I = opt.Icon;
  return <I className={className} />;
}

function formatWhen(ts: number) {
  try {
    return new Date(ts).toLocaleString("it-IT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function AccessPage() {
  const doCreate = useServerFn(createGuestPassword);
  const doList = useServerFn(getGuestPasswords);
  const doRevoke = useServerFn(revokeGuestPassword);

  const [label, setLabel] = useState("Ospite");
  const [durationHours, setDurationHours] = useState<1 | 6 | 24 | 168>(24);
  const [maxUses, setMaxUses] = useState<string>("");
  const [icon, setIcon] = useState<TempIcon>("none");
  const [permissions, setPermissions] = useState<Permission[]>([...DEFAULT_GUEST_PERMISSIONS]);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<GuestItem[]>([]);
  const [fresh, setFresh] = useState<{
    password: string;
    label: string;
    icon: TempIcon;
    expiresAt: number;
    permissions: Permission[];
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await doList({});
    if (res.ok) setItems(res.items as GuestItem[]);
  }, [doList]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function togglePerm(p: Permission) {
    setPermissions((prev) => {
      if (prev.includes(p)) {
        if (p === "home") return prev; // home sempre on
        return prev.filter((x) => x !== p);
      }
      return [...prev, p];
    });
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFresh(null);
    const uses = maxUses.trim() === "" ? null : Math.max(1, Math.min(100, Number(maxUses) || 1));
    const res = await doCreate({
      data: {
        label: label.trim() || "Ospite",
        durationHours,
        maxUses: uses,
        icon,
        permissions,
      },
    });
    setBusy(false);
    if (!res.ok) {
      setError((res as { message?: string }).message ?? "Errore");
      return;
    }
    setFresh({
      password: res.password,
      label: res.label,
      icon: (res as { icon?: TempIcon }).icon ?? icon,
      expiresAt: res.expiresAt,
      permissions: (res as { permissions?: Permission[] }).permissions ?? permissions,
    });
    setLabel("Ospite");
    setIcon("none");
    setPermissions([...DEFAULT_GUEST_PERMISSIONS]);
    await refresh();
  }

  async function onRevoke(id: string) {
    await doRevoke({ data: { id } });
    if (fresh) setFresh(null);
    await refresh();
  }

  async function copyPassword() {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh.password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  const groups = [
    { id: "mondi" as const, title: "Cosa può vedere — Mondi" },
    { id: "strumenti" as const, title: "Strumenti" },
    { id: "azioni" as const, title: "Azioni" },
  ];

  return (
    <AppShell title="Accesso" subtitle="Inviti temporanei, permessi e cosa possono fare">
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        <form onSubmit={onCreate} className="panel-spacious space-y-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">Nuovo invito</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Genera una password temporanea. Al primo accesso l&apos;ospite dovrà creare la sua
                password personale; i permessi che scegli qui restano legati a lui.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="tp-label" className="text-label">
                Etichetta
              </label>
              <input
                id="tp-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="input-field"
                placeholder="Es. Amico, Collaboratore"
                maxLength={80}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="tp-uses" className="text-label">
                Max utilizzi invito (opzionale)
              </label>
              <input
                id="tp-uses"
                type="number"
                min={1}
                max={100}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                className="input-field"
                placeholder="Illimitati"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-label">Icona da visualizzare</p>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map((opt) => {
                const selected = icon === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    title={opt.label}
                    onClick={() => setIcon(opt.id)}
                    className={`btn-matrix inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium ${
                      selected
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-white/8 text-muted-foreground hover:border-white/15 hover:text-foreground"
                    }`}
                  >
                    {opt.Icon ? <opt.Icon className="h-4 w-4" /> : <span className="text-[11px]">—</span>}
                    <span className="hidden sm:inline">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-label">Permessi — cosa può vedere e fare</p>
            {groups.map((g) => (
              <div key={g.id} className="space-y-2">
                <p className="text-[11px] font-medium text-muted-foreground">{g.title}</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_PERMISSIONS.filter((p) => PERMISSION_META[p].group === g.id).map((p) => {
                    const on = permissions.includes(p);
                    const locked = p === "home";
                    return (
                      <button
                        key={p}
                        type="button"
                        disabled={locked}
                        onClick={() => togglePerm(p)}
                        className={`btn-matrix inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                          on
                            ? "border-primary/40 bg-primary/15 text-primary"
                            : "border-white/8 text-muted-foreground hover:border-white/15"
                        } ${locked ? "opacity-80" : ""}`}
                      >
                        {on ? <Check className="h-3 w-3" /> : null}
                        {PERMISSION_META[p].label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground/80">
              Consigliato: lascia "Gestione accessi" disattivata per gli ospiti. Power e Console solo
              se ti fidi di azioni sul server.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-label">Durata invito</p>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.hours}
                  type="button"
                  onClick={() => setDurationHours(d.hours)}
                  className={`btn-matrix rounded-lg border px-3.5 py-2 text-[13px] font-medium ${
                    durationHours === d.hours
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-white/8 text-muted-foreground hover:border-white/15 hover:text-foreground"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || permissions.length === 0}
            className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {busy ? "Generazione…" : "Crea invito"}
          </button>
        </form>

        {fresh ? (
          <div className="panel-spacious space-y-4 animate-fade-in-up border-primary/25">
            <p className="text-label text-primary">Invito generato — copialo ora</p>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {fresh.icon !== "none" ? (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                  <IconBadge icon={fresh.icon} className="h-3.5 w-3.5" />
                </span>
              ) : null}
              <span className="font-medium text-foreground">{fresh.label}</span>
              <span>· scade {formatWhen(fresh.expiresAt)}</span>
            </p>
            <p className="text-[12px] text-muted-foreground">
              Permessi:{" "}
              {fresh.permissions.map((p) => PERMISSION_META[p]?.label ?? p).join(" · ")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 rounded-lg border border-white/10 bg-black/40 px-4 py-3 font-mono text-base tracking-wide text-primary">
                {fresh.password}
              </code>
              <button
                type="button"
                onClick={() => void copyPassword()}
                className="btn-matrix inline-flex h-11 items-center gap-2 rounded-lg border border-white/10 px-4 text-sm text-foreground hover:border-primary/40"
              >
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiata" : "Copia"}
              </button>
            </div>
            <p className="text-[12px] text-muted-foreground/80">
              Al login con questa password l&apos;ospite viene portato a creare la sua password.
            </p>
          </div>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold tracking-tight">Inviti attivi</h2>
            <button
              type="button"
              onClick={() => void refresh()}
              className="text-[12px] font-medium text-muted-foreground hover:text-primary"
            >
              Aggiorna
            </button>
          </div>

          {items.length === 0 ? (
            <div className="panel rounded-xl px-5 py-10 text-center text-sm text-muted-foreground">
              Nessun invito temporaneo attivo.
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="panel flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3.5"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    {item.icon && item.icon !== "none" ? (
                      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                        <IconBadge icon={item.icon} className="h-4 w-4" />
                      </span>
                    ) : (
                      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/8 text-muted-foreground/50">
                        <KeyRound className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium tracking-tight text-foreground">{item.label}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          scade {formatWhen(item.expiresAt)}
                        </span>
                        <span>
                          usi {item.uses}
                          {item.maxUses != null ? ` / ${item.maxUses}` : ""}
                        </span>
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground/80">
                        {(item.permissions || [])
                          .map((p) => PERMISSION_META[p]?.label ?? p)
                          .join(" · ") || "—"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onRevoke(item.id)}
                    className="btn-matrix inline-flex items-center gap-1.5 rounded-lg border border-white/8 px-3 py-2 text-[12px] text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Revoca
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-center text-[12px] text-muted-foreground/70">
          Inviti e membri registrati restano in memoria del server (si azzerano al riavvio).
        </p>
      </div>
    </AppShell>
  );
}
