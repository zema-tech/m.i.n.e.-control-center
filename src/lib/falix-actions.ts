/**
 * Catalogo delle azioni Falix disponibili (client-safe: contiene solo metodo,
 * percorso e livello di rischio — nessuna chiave API).
 *
 * Percorsi verificati contro l'API v2 (https://client.falixnodes.net/api/v2,
 * documentazione: https://client.falixnodes.net/profile/apidocs).
 *
 * risk:
 *  - "read"     → sola lettura, eseguibile con un click
 *  - "write"    → modifica il server, richiede approvazione esplicita
 *  - "critical" → distruttiva/irreversibile, richiede doppia approvazione
 */
export type ActionRisk = "read" | "write" | "critical";

export type FalixAction = {
  id: string;
  label: string;
  scope: string;
  risk: ActionRisk;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Segnaposto: {id} = server id, {altro} = parametro fornito dall'IA. */
  path: string;
  /** Parametri richiesti nel body (per metodi non GET). */
  body?: string[];
};

const A = (
  id: string,
  label: string,
  scope: string,
  risk: ActionRisk,
  method: FalixAction["method"],
  path: string,
  body?: string[],
): FalixAction => ({ id, label, scope, risk, method, path, ...(body ? { body } : {}) });

export const FALIX_ACTIONS: FalixAction[] = [
  /* ---------------------------------------------------------------- lettura */
  A("servers.list", "Elenco server dell'account", "servers:read", "read", "GET", "/servers"),
  A("server.status", "Stato console", "servers:read", "read", "GET", "/servers/{id}/console/status"),
  A("server.info", "Dettagli server (limiti, software)", "servers:read", "read", "GET", "/servers/{id}"),
  A("server.resources", "Risorse assegnate (CPU/RAM/disco)", "servers:read", "read", "GET", "/servers/{id}/resources"),
  A("server.activity", "Registro attività", "servers:activity:read", "read", "GET", "/servers/{id}/activity"),
  A("players.list", "Giocatori online", "servers:players:read", "read", "GET", "/servers/{id}/players"),
  A("files.list", "Elenco file", "servers:files:read", "read", "GET", "/servers/{id}/files?path={path}"),
  A("files.read", "Leggi file", "servers:files:read", "read", "GET", "/servers/{id}/files/content?path={path}"),
  A("logs.latest", "Log più recente (/logs/latest.log)", "servers:files:read", "read", "GET", "/servers/{id}/files/content?path=/logs/latest.log"),
  A("backups.list", "Elenco backup", "servers:backups:read", "read", "GET", "/servers/{id}/backups"),
  A("properties.read", "server.properties", "servers:properties:read", "read", "GET", "/servers/{id}/properties"),
  A("settings.read", "Impostazioni server", "servers:settings:read", "read", "GET", "/servers/{id}/settings"),
  A("startup.read", "Parametri di avvio", "servers:startup:read", "read", "GET", "/servers/{id}/startup"),
  A("allocations.list", "Allocazioni", "servers:allocations:read", "read", "GET", "/servers/{id}/allocations"),
  A("ports.list", "Porte", "servers:ports:read", "read", "GET", "/servers/{id}/ports"),
  A("databases.list", "Elenco database", "servers:databases:read", "read", "GET", "/servers/{id}/databases"),
  A("schedules.list", "Pianificazioni", "servers:schedules:read", "read", "GET", "/servers/{id}/schedules"),
  A("worlds.list", "Elenco mondi", "servers:worlds:read", "read", "GET", "/servers/{id}/worlds"),
  A("addons.list", "Plugin / mod / datapack", "servers:addons:read", "read", "GET", "/servers/{id}/addons"),
  A("modules.list", "Moduli", "servers:modules:read", "read", "GET", "/servers/{id}/modules"),
  A("subusers.list", "Sottoutenti", "servers:subusers:read", "read", "GET", "/servers/{id}/subusers"),
  A("domains.list", "Domini personalizzati", "servers:domains:read", "read", "GET", "/servers/{id}/domains"),
  A("subdomains.list", "Sottodomini", "servers:subdomains:read", "read", "GET", "/servers/{id}/subdomains"),
  A("proxies.read", "Proxy", "servers:proxies:read", "read", "GET", "/servers/{id}/proxies"),
  A("firewall.read", "Firewall", "servers:firewall:read", "read", "GET", "/servers/{id}/firewall"),
  A("instances.list", "Istanze", "servers:instances:read", "read", "GET", "/servers/{id}/instances"),
  A("git.read", "Stato integrazioni Git", "servers:git:read", "read", "GET", "/servers/{id}/git"),
  A("sftp.read", "Credenziali SFTP", "servers:sftp:read", "read", "GET", "/servers/{id}/sftp"),
  A("advertisement.read", "Advertisement", "servers:advertisement:read", "read", "GET", "/servers/{id}/advertisement"),
  A("support.read", "Accesso supporto", "servers:support-access:read", "read", "GET", "/servers/{id}/support-access"),
  A("applications.read", "Applicazioni disponibili", "applications:read", "read", "GET", "/applications"),
  A("tickets.read", "Ticket account", "account:tickets:read", "read", "GET", "/account/tickets"),
  A("sshkeys.read", "Chiavi SSH", "account:ssh-keys:read", "read", "GET", "/account/ssh-keys"),
  A("integrations.read", "Integrazioni account", "account:integrations:read", "read", "GET", "/account/integrations"),
  A("billing.read", "Fatturazione", "account:billing:read", "read", "GET", "/account/billing"),

  /* ----------------------------------------------------- scrittura / azioni */
  A("command.send", "Invia comando console", "servers:command", "write", "POST", "/servers/{id}/commands", ["command"]),
  A("power.start", "Avvia server", "servers:power", "write", "POST", "/servers/{id}/power", ["signal"]),
  A("power.stop", "Spegni server", "servers:power", "write", "POST", "/servers/{id}/power", ["signal"]),
  A("power.restart", "Riavvia server", "servers:power", "write", "POST", "/servers/{id}/power", ["signal"]),
  A("power.kill", "Arresto forzato (kill)", "servers:power", "critical", "POST", "/servers/{id}/power", ["signal"]),
  A("files.write", "Scrivi file", "servers:files:write", "write", "POST", "/servers/{id}/files/write?path={path}", ["content"]),
  A("files.rename", "Rinomina file", "servers:files:write", "write", "POST", "/servers/{id}/files/rename", ["from", "to"]),
  A("files.copy", "Copia file", "servers:files:write", "write", "POST", "/servers/{id}/files/copy", ["path"]),
  A("files.mkdir", "Crea cartella", "servers:files:write", "write", "POST", "/servers/{id}/files/create-folder", ["path"]),
  A("files.compress", "Comprimi file", "servers:files:write", "write", "POST", "/servers/{id}/files/compress", ["paths"]),
  A("files.decompress", "Estrai archivio", "servers:files:write", "write", "POST", "/servers/{id}/files/decompress", ["path"]),
  A("properties.write", "Modifica server.properties", "servers:properties:write", "write", "PUT", "/servers/{id}/properties", ["key", "value"]),
  A("settings.write", "Modifica impostazioni", "servers:settings:write", "write", "PUT", "/servers/{id}/settings", ["key", "value"]),
  A("startup.write", "Modifica parametri di avvio", "servers:startup:write", "write", "PUT", "/servers/{id}/startup", ["key", "value"]),
  A("allocations.create", "Aggiungi allocazione", "servers:allocations:write", "write", "POST", "/servers/{id}/allocations"),
  A("ports.create", "Aggiungi porta", "servers:ports:write", "write", "POST", "/servers/{id}/ports", ["port"]),
  A("backups.create", "Crea backup", "servers:backups:write", "write", "POST", "/servers/{id}/backups", ["name"]),
  A("backups.restore", "Ripristina backup", "servers:backups:restore", "critical", "POST", "/servers/{id}/backups/{backup}/restore"),
  A("backups.delete", "Elimina backup", "servers:backups:write", "critical", "DELETE", "/servers/{id}/backups/{backup}"),
  A("databases.create", "Crea database", "servers:databases:write", "write", "POST", "/servers/{id}/databases", ["name"]),
  A("databases.delete", "Elimina database", "servers:databases:write", "critical", "DELETE", "/servers/{id}/databases/{database}"),
  A("schedules.write", "Crea pianificazione", "servers:schedules:write", "write", "POST", "/servers/{id}/schedules", ["name", "cron", "action"]),
  A("worlds.write", "Gestisci mondi", "servers:worlds:write", "write", "POST", "/servers/{id}/worlds", ["name", "action"]),
  A("players.write", "Gestisci giocatori (kick/ban/op)", "servers:players:write", "write", "POST", "/servers/{id}/players", ["player", "action"]),
  A("addons.write", "Installa/rimuovi plugin o mod", "servers:addons:write", "write", "POST", "/servers/{id}/addons", ["name", "action"]),
  A("modules.write", "Gestisci moduli", "servers:modules:write", "write", "POST", "/servers/{id}/modules", ["name", "action"]),
  A("subusers.write", "Gestisci sottoutenti", "servers:subusers:write", "write", "POST", "/servers/{id}/subusers", ["email", "permissions"]),
  A("domains.write", "Gestisci domini", "servers:domains:write", "write", "POST", "/servers/{id}/domains", ["domain"]),
  A("subdomains.write", "Gestisci sottodomini", "servers:subdomains:write", "write", "POST", "/servers/{id}/subdomains", ["subdomain"]),
  A("proxies.write", "Gestisci proxy", "servers:proxies:write", "write", "POST", "/servers/{id}/proxies", ["name", "action"]),
  A("firewall.write", "Modifica regole firewall", "servers:firewall:write", "write", "POST", "/servers/{id}/firewall", ["rule", "action"]),
  A("git.write", "Configura Git", "servers:git:write", "write", "POST", "/servers/{id}/git", ["repository", "branch"]),
  A("git.deploy", "Deploy da Git", "servers:git:deploy", "write", "POST", "/servers/{id}/git/deploy"),
  A("init.deploy", "Deploy iniziale", "servers:init:deploy", "write", "POST", "/servers/{id}/init/deploy"),
  A("importer.write", "Importa server", "servers:importer:write", "write", "POST", "/servers/{id}/importer", ["source"]),
  A("instances.write", "Gestisci istanze", "servers:instances:write", "write", "POST", "/servers/{id}/instances", ["name", "action"]),
  A("advertisement.write", "Modifica advertisement", "servers:advertisement:write", "write", "POST", "/servers/{id}/advertisement", ["value"]),
  A("support.write", "Concedi/revoca accesso supporto", "servers:support-access:write", "write", "POST", "/servers/{id}/support-access", ["enabled"]),
  A("tickets.write", "Apri ticket", "account:tickets:write", "write", "POST", "/account/tickets", ["subject", "message"]),
  A("sshkeys.write", "Aggiungi chiave SSH", "account:ssh-keys:write", "write", "POST", "/account/ssh-keys", ["name", "key"]),
  A("billing.write", "Operazione fatturazione", "account:billing:write", "critical", "POST", "/account/billing", ["action"]),

  /* --------------------------------------------------------------- critiche */
  A("server.reinstall", "Reinstalla server", "servers:reinstall", "critical", "POST", "/servers/{id}/reinstall"),
  A("server.create", "Crea nuovo server", "servers:create", "critical", "POST", "/servers", ["name", "egg"]),
  A("server.delete", "ELIMINA server", "servers:delete", "critical", "DELETE", "/servers/{id}"),
  A("files.delete", "Elimina file", "servers:files:write", "critical", "POST", "/servers/{id}/files/delete", ["paths"]),
  A("instances.delete", "Elimina istanza", "servers:instances:delete", "critical", "DELETE", "/servers/{id}/instances/{instance}"),
];

export const ACTIONS_BY_ID = new Map(FALIX_ACTIONS.map((a) => [a.id, a]));

export function getAction(id: string): FalixAction | undefined {
  return ACTIONS_BY_ID.get(id);
}

export function riskLabel(risk: ActionRisk): string {
  return risk === "read" ? "lettura" : risk === "write" ? "approvazione" : "critica";
}
