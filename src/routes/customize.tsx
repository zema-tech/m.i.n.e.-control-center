import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  Blocks,
  Bot,
  Cable,
  Check,
  ChevronRight,
  CircleDot,
  Code2,
  FileCode2,
  Github,
  PackagePlus,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  loadAgentSkills,
  proposeOrCreateSkill,
  removeSkill,
  setSkillStatus,
  type AgentSkill,
} from "@/lib/agent-skills";
import { getAuthState } from "@/lib/auth.functions";
import { ensureDefaultConnectors, type CustomConnector } from "@/lib/connectors";
import {
  addJarvisPlugin,
  handoffToJarvis,
  loadJarvisPlugins,
  parseGitHubRepository,
  removeJarvisPlugin,
  setJarvisPluginEnabled,
  type JarvisPlugin,
} from "@/lib/jarvis-plugins";

export const Route = createFileRoute("/customize")({
  head: () => ({
    meta: [
      { title: "Personalizza — JARVIS" },
      {
        name: "description",
        content: "Gestisci Skill, Plugin e Connettori del tuo agente JARVIS.",
      },
    ],
  }),
  loader: async () => {
    const state = await getAuthState();
    if (!state.authenticated) throw redirect({ to: "/login" });
    return null;
  },
  component: CustomizePage,
});

type Composer = "skill" | "plugin" | "github" | "jarvis-skill" | "jarvis-plugin" | null;

const fieldClass = "border-white/10 bg-black/20 focus-visible:ring-primary/40";

function sourceLabel(source: JarvisPlugin["source"]) {
  switch (source) {
    case "builtin":
      return "JARVIS";
    case "github":
      return "GitHub";
    case "jarvis":
      return "con JARVIS";
    case "manual":
      return "manuale";
  }
}

function CustomizePage() {
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [plugins, setPlugins] = useState<JarvisPlugin[]>([]);
  const [connectors, setConnectors] = useState<CustomConnector[]>([]);
  const [query, setQuery] = useState("");
  const [composer, setComposer] = useState<Composer>(null);
  const [message, setMessage] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  function refresh() {
    setSkills(loadAgentSkills());
    setPlugins(loadJarvisPlugins());
    setConnectors(ensureDefaultConnectors());
  }

  useEffect(() => refresh(), []);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleSkills = useMemo(
    () =>
      skills.filter(
        (item) =>
          !normalizedQuery ||
          `${item.name} ${item.description} ${(item.tags ?? []).join(" ")}`
            .toLowerCase()
            .includes(normalizedQuery),
      ),
    [skills, normalizedQuery],
  );
  const visiblePlugins = useMemo(
    () =>
      plugins.filter(
        (item) =>
          !normalizedQuery ||
          `${item.name} ${item.description} ${item.capabilities.join(" ")}`
            .toLowerCase()
            .includes(normalizedQuery),
      ),
    [plugins, normalizedQuery],
  );
  const visibleConnectors = useMemo(
    () =>
      connectors.filter(
        (item) =>
          !normalizedQuery ||
          `${item.label} ${item.detail} ${item.kind}`.toLowerCase().includes(normalizedQuery),
      ),
    [connectors, normalizedQuery],
  );

  function toggleSkill(skill: AgentSkill, enabled: boolean) {
    setSkillStatus(skill.id, enabled ? "active" : "draft");
    refresh();
  }

  function deleteSkill(skill: AgentSkill) {
    if (!window.confirm(`Eliminare la skill “${skill.name}”?`)) return;
    removeSkill(skill.id);
    refresh();
  }

  function togglePlugin(plugin: JarvisPlugin, enabled: boolean) {
    setPlugins(setJarvisPluginEnabled(plugin.id, enabled));
  }

  function deletePlugin(plugin: JarvisPlugin) {
    if (plugin.source === "builtin") return;
    if (!window.confirm(`Rimuovere il plugin “${plugin.name}”?`)) return;
    setPlugins(removeJarvisPlugin(plugin.id));
  }

  async function importSkill(file: File) {
    const body = (await file.text()).trim();
    if (!body) {
      setMessage("Il file SKILL.md è vuoto.");
      return;
    }
    const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
    const fallbackName = file.name.replace(/\.md$/i, "").replace(/[-_]+/g, " ");
    const description =
      body
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line && !line.startsWith("#")) ?? "Skill importata da file SKILL.md";
    const result = proposeOrCreateSkill({
      name: heading || fallbackName,
      description,
      body,
      source: "user",
      activate: false,
    });
    setMessage(result.message);
    refresh();
  }

  return (
    <AppShell
      title="Personalizza"
      subtitle="Il tuo JARVIS, costruito intorno al tuo modo di lavorare"
    >
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.12] via-card/80 to-card/40 p-5 shadow-card sm:p-8">
          <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative max-w-3xl">
            <Badge variant="outline" className="mb-4 border-primary/25 bg-primary/5 text-primary">
              <WandSparkles className="mr-1.5 h-3 w-3" /> Moduli JARVIS
            </Badge>
            <h2 className="font-display text-2xl font-semibold tracking-[-0.045em] text-foreground sm:text-3xl">
              Insegna a JARVIS come lavorare con te.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Le Skill conservano procedure riutilizzabili. I Plugin riuniscono skill, comandi,
              agenti e hook. I Connettori collegano servizi e dati esterni: tutto in un solo posto.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => setComposer("jarvis-skill")} className="gap-2 rounded-xl">
                <Sparkles className="h-4 w-4" /> Crea con JARVIS
              </Button>
              <Button
                variant="outline"
                onClick={() => setComposer("skill")}
                className="gap-2 rounded-xl border-white/10 bg-black/10"
              >
                <Plus className="h-4 w-4" /> Crea a mano
              </Button>
              <Button
                variant="ghost"
                onClick={() => setComposer("github")}
                className="gap-2 rounded-xl text-muted-foreground"
              >
                <Github className="h-4 w-4" /> Importa da GitHub
              </Button>
            </div>
          </div>
        </section>

        {message ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm text-primary">
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4" /> {message}
            </span>
            <button
              type="button"
              onClick={() => setMessage(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Chiudi
            </button>
          </div>
        ) : null}

        <div className="relative mt-6">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cerca skill, plugin o connettori…"
            className={`${fieldClass} h-11 rounded-xl pl-10`}
          />
        </div>

        <Tabs defaultValue="skills" className="mt-6">
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-black/15 p-1 sm:w-auto">
            <TabsTrigger value="skills" className="gap-2 rounded-lg px-4 py-2">
              <FileCode2 className="h-4 w-4" /> Skill{" "}
              <span className="text-[10px] opacity-55">{skills.length}</span>
            </TabsTrigger>
            <TabsTrigger value="plugins" className="gap-2 rounded-lg px-4 py-2">
              <Blocks className="h-4 w-4" /> Plugin{" "}
              <span className="text-[10px] opacity-55">{plugins.length}</span>
            </TabsTrigger>
            <TabsTrigger value="connectors" className="gap-2 rounded-lg px-4 py-2">
              <Cable className="h-4 w-4" /> Connettori{" "}
              <span className="text-[10px] opacity-55">{connectors.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="skills" className="mt-6 space-y-4">
            <SectionHeading
              title="Skill di JARVIS"
              description="File di istruzioni caricati solo quando servono. Puoi scriverli, importarli o crearli insieme all’agente."
              actions={
                <>
                  <input
                    ref={importRef}
                    type="file"
                    accept=".md,text/markdown,text/plain"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void importSkill(file);
                      event.target.value = "";
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => importRef.current?.click()}
                    className="gap-1.5 rounded-lg border-white/10"
                  >
                    <Upload className="h-3.5 w-3.5" /> Importa SKILL.md
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setComposer("skill")}
                    className="gap-1.5 rounded-lg"
                  >
                    <Plus className="h-3.5 w-3.5" /> Nuova skill
                  </Button>
                </>
              }
            />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleSkills.map((skill) => (
                <article
                  key={skill.id}
                  className="group flex min-h-56 flex-col rounded-2xl border border-white/[0.07] bg-card/65 p-5 transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-glow-soft"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/[0.08] text-primary">
                      <FileCode2 className="h-5 w-5" />
                    </div>
                    <Switch
                      checked={skill.status === "active"}
                      onCheckedChange={(checked) => toggleSkill(skill, checked)}
                      aria-label={`${skill.status === "active" ? "Disattiva" : "Attiva"} ${skill.name}`}
                    />
                  </div>
                  <h3 className="mt-4 break-words font-display text-base font-semibold text-foreground">
                    {skill.name}
                  </h3>
                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">
                    {skill.description}
                  </p>
                  <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-[9px] uppercase tracking-wide">
                        {skill.status}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-white/10 text-[9px] text-muted-foreground"
                      >
                        {skill.source === "agent" ? "JARVIS" : "Tu"}
                      </Badge>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteSkill(skill)}
                      className="rounded-lg p-1.5 text-muted-foreground opacity-50 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      aria-label={`Elimina ${skill.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {visibleSkills.length === 0 ? <NoResults /> : null}
          </TabsContent>

          <TabsContent value="plugins" className="mt-6 space-y-4">
            <SectionHeading
              title="Plugin installati"
              description="Pacchetti completi che combinano più capacità e si attivano come un’unica unità."
              actions={
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setComposer("github")}
                    className="gap-1.5 rounded-lg border-white/10"
                  >
                    <Github className="h-3.5 w-3.5" /> Importa GitHub
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setComposer("plugin")}
                    className="gap-1.5 rounded-lg"
                  >
                    <PackagePlus className="h-3.5 w-3.5" /> Nuovo plugin
                  </Button>
                </>
              }
            />
            <div className="grid gap-3 md:grid-cols-2">
              {visiblePlugins.map((plugin) => (
                <article
                  key={plugin.id}
                  className="group rounded-2xl border border-white/[0.07] bg-card/65 p-5 transition hover:border-primary/25 hover:shadow-glow-soft"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/[0.08] text-primary">
                      {plugin.source === "github" ? (
                        <Github className="h-5 w-5" />
                      ) : (
                        <Blocks className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-display text-base font-semibold text-foreground">
                            {plugin.name}
                          </h3>
                          <p className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                            {sourceLabel(plugin.source)}
                          </p>
                        </div>
                        <Switch
                          checked={plugin.enabled}
                          onCheckedChange={(checked) => togglePlugin(plugin, checked)}
                          aria-label={`${plugin.enabled ? "Disattiva" : "Attiva"} ${plugin.name}`}
                        />
                      </div>
                      <p className="mt-3 text-xs leading-5 text-muted-foreground">
                        {plugin.description}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-1.5">
                        {plugin.capabilities.length > 0 ? (
                          plugin.capabilities.map((item) => (
                            <Badge
                              key={item}
                              variant="secondary"
                              className="text-[9px] font-medium"
                            >
                              {item}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="secondary" className="text-[9px]">
                            Configurazione vuota
                          </Badge>
                        )}
                        {plugin.repository ? (
                          <a
                            href={plugin.repository}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-auto inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                          >
                            Repository <ChevronRight className="h-3 w-3" />
                          </a>
                        ) : null}
                        {plugin.source !== "builtin" ? (
                          <button
                            type="button"
                            onClick={() => deletePlugin(plugin)}
                            className="ml-auto rounded-lg p-1.5 text-muted-foreground opacity-50 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                            aria-label={`Rimuovi ${plugin.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {visiblePlugins.length === 0 ? <NoResults /> : null}
            <button
              type="button"
              onClick={() => setComposer("jarvis-plugin")}
              className="flex w-full items-center gap-4 rounded-2xl border border-dashed border-primary/20 bg-primary/[0.03] p-5 text-left transition hover:border-primary/40 hover:bg-primary/[0.06]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Bot className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  Progetta un plugin con JARVIS
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Descrivi il risultato: l’agente ti aiuta a scegliere skill, comandi e connettori.
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-primary" />
            </button>
          </TabsContent>

          <TabsContent value="connectors" className="mt-6 space-y-4">
            <SectionHeading
              title="Connettori"
              description="Porte di accesso a servizi, dati e server MCP già disponibili per JARVIS."
              actions={
                <Button asChild size="sm" className="gap-1.5 rounded-lg">
                  <Link to="/connectors">
                    <Plus className="h-3.5 w-3.5" /> Gestisci connettori
                  </Link>
                </Button>
              }
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleConnectors.map((connector) => (
                <article
                  key={connector.id}
                  className="rounded-2xl border border-white/[0.07] bg-card/65 p-4 transition hover:border-primary/25"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/[0.08] text-primary">
                      <Cable className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-foreground">
                        {connector.label}
                      </h3>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {connector.kind}
                      </p>
                    </div>
                    <span
                      className={`flex items-center gap-1 text-[10px] ${connector.status === "online" ? "text-emerald-300" : "text-muted-foreground"}`}
                    >
                      <CircleDot className="h-3 w-3" />{" "}
                      {connector.status === "online" ? "attivo" : connector.status}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {connector.detail}
                  </p>
                </article>
              ))}
            </div>
            {visibleConnectors.length === 0 ? <NoResults /> : null}
          </TabsContent>
        </Tabs>
      </main>

      <ComposerDialog
        kind={composer}
        onClose={() => setComposer(null)}
        onSaved={(text) => {
          setComposer(null);
          setMessage(text);
          refresh();
        }}
      />
    </AppShell>
  );
}

function SectionHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
    </div>
  );
}

function NoResults() {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center">
      <Search className="mx-auto h-5 w-5 text-muted-foreground" />
      <p className="mt-2 text-sm text-muted-foreground">Nessun risultato per questa ricerca.</p>
    </div>
  );
}

function ComposerDialog({
  kind,
  onClose,
  onSaved,
}: {
  kind: Composer;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName("");
    setDescription("");
    setDetails("");
    setError(null);
  }, [kind]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!kind) return;
    setError(null);

    if (kind === "skill") {
      const result = proposeOrCreateSkill({
        name,
        description,
        body: details,
        source: "user",
        activate: true,
      });
      if (!result.ok) return setError(result.message);
      return onSaved(result.message);
    }

    if (kind === "plugin") {
      if (!name.trim() || !description.trim())
        return setError("Nome e descrizione sono obbligatori.");
      addJarvisPlugin({
        name,
        description,
        source: "manual",
        capabilities: details.split(","),
      });
      return onSaved(`Plugin “${name.trim()}” creato e attivato.`);
    }

    if (kind === "github") {
      const parsed = parseGitHubRepository(details);
      if (!parsed.ok || !parsed.name || !parsed.url)
        return setError(parsed.error ?? "Repository non valido.");
      addJarvisPlugin({
        name: parsed.name,
        description: description.trim() || `Plugin importato da ${parsed.url}`,
        source: "github",
        repository: parsed.url,
        capabilities: ["Repository GitHub"],
      });
      return onSaved(`Plugin “${parsed.name}” importato nel catalogo.`);
    }

    if (!details.trim()) return setError("Descrivi cosa vuoi costruire con JARVIS.");
    const target = kind === "jarvis-skill" ? "skill" : "plugin";
    handoffToJarvis(target, details.trim());
    window.location.assign("/jarvis");
  }

  const jarvisMode = kind === "jarvis-skill" || kind === "jarvis-plugin";
  const title =
    kind === "skill"
      ? "Nuova Skill"
      : kind === "plugin"
        ? "Nuovo Plugin"
        : kind === "github"
          ? "Importa Plugin da GitHub"
          : kind === "jarvis-plugin"
            ? "Progetta un Plugin con JARVIS"
            : "Crea una Skill con JARVIS";

  return (
    <Dialog
      open={kind !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl border-white/10 bg-card shadow-elevated sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            {jarvisMode ? (
              <Sparkles className="h-5 w-5 text-primary" />
            ) : kind === "github" ? (
              <Github className="h-5 w-5 text-primary" />
            ) : (
              <Code2 className="h-5 w-5 text-primary" />
            )}
            {title}
          </DialogTitle>
          <DialogDescription>
            {jarvisMode
              ? "Racconta il risultato che vuoi ottenere. Continuerai nella chat con l’agente."
              : kind === "github"
                ? "Registra nel catalogo un plugin ospitato in un repository GitHub."
                : "Salvato localmente nel profilo corrente di JARVIS."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {kind === "skill" || kind === "plugin" ? (
            <label className="block space-y-1.5 text-xs font-medium text-foreground">
              Nome
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={kind === "skill" ? "es. report-settimanale" : "es. Marketing Toolkit"}
                className={fieldClass}
                autoFocus
              />
            </label>
          ) : null}
          {kind === "skill" || kind === "plugin" || kind === "github" ? (
            <label className="block space-y-1.5 text-xs font-medium text-foreground">
              Descrizione{" "}
              {kind === "github" ? (
                <span className="font-normal text-muted-foreground">(facoltativa)</span>
              ) : null}
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Quando serve e cosa fa"
                className={fieldClass}
              />
            </label>
          ) : null}
          <label className="block space-y-1.5 text-xs font-medium text-foreground">
            {kind === "skill"
              ? "Contenuto SKILL.md"
              : kind === "plugin"
                ? "Elementi inclusi (separati da virgola)"
                : kind === "github"
                  ? "URL repository GitHub"
                  : "Cosa vuoi ottenere?"}
            {kind === "github" ? (
              <Input
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="https://github.com/owner/repository"
                className={fieldClass}
                autoFocus
              />
            ) : (
              <Textarea
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder={
                  jarvisMode
                    ? "es. Ogni venerdì raccogli i dati del progetto e prepara un report…"
                    : kind === "plugin"
                      ? "3 skill, 2 comandi, GitHub MCP"
                      : "# Nome\n\n## Quando usarla\n…"
                }
                rows={jarvisMode || kind === "skill" ? 7 : 4}
                className={`${fieldClass} resize-none`}
                autoFocus={jarvisMode}
              />
            )}
          </label>
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit" className="gap-2">
              {jarvisMode ? (
                <>
                  <Sparkles className="h-4 w-4" /> Continua con JARVIS
                </>
              ) : kind === "github" ? (
                <>
                  <Github className="h-4 w-4" /> Importa
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> Salva
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
