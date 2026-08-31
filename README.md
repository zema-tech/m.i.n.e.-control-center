# M.I.N.E. Control Center

> Nucleo web di **Omnicore** — sistema multi-agente.

Control Center personale (dark / cyberpunk) da cui orchestrare cinque IA specializzate. Nato come pannello Minecraft su Falix; oggi è l’hub UI di tutto Omnicore.

**Repo correlato (pubblico, self-host):** [omnicore-agent](https://github.com/zema-tech/omnicore-agent)

---

## Omnicore — gli agenti

| Agente | Ruolo | Sezione UI |
|--------|--------|------------|
| **J.A.R.V.I.S** | IA principale / orchestratore | `/jarvis` · chat · pilastri · connettori |
| **E.D.I.T** | Social & content | `/edit` *(in arrivo)* |
| **M.I.N.E** | Gaming & host (Minecraft / Falix) | `/mine` · rete · host · skills |
| **P.R.O.M.P.T** | Coding agent | `/code` |
| **A.R.T** | Design & identità visiva | `/design` |

J.A.R.V.I.S resta il cervello centrale (carattere, memoria, regole, mani). Gli altri agenti sono domini specializzati sotto lo stesso nucleo.

---

## Cosa fa questo repo

- **Hub** (`/home`) — scelta del “mondo” / agente
- **J.A.R.V.I.S** — profilo agente, 4 pilastri, chat assistant, connettori (One MCP e altri)
- **M.I.N.E** — host Falix, rete neurale, log, power, competenze
- **P.R.O.M.P.T** — workspace coding (architect / debug / review)
- **A.R.T** — studio design (palette, componenti)
- Auth locale (password + JWT), API key in settings (mai hardcodate)

Stack: React · TanStack Start · Tailwind · backend Node (Nitro). Deploy tipico: Lovable / Vercel.

---

## Principi

1. **L’IA propone, tu confermi** — nessuna azione write/critical senza approvazione umana.
2. **BYOK** — chiavi Groq / Falix / altri servizi le inserisci tu nelle impostazioni.
3. **Dark theme totale** — Matrix / cyberpunk (verde, azzurro, blu, violetto per sezione).
4. **Lingua UI: italiano.**

---

## Sviluppo locale

```sh
git clone https://github.com/zema-tech/m.i.n.e.-control-center.git
cd m.i.n.e.-control-center
npm i   # oppure bun install
npm run dev
```

Variabili d’ambiente e password di login: vedi configurazione auth / `.env` (non committare secret).

### Lovable

Progetto collegato a [Lovable](https://lovable.dev/projects/a08747ed-d009-4084-8e55-286cd368f219). I commit su `main` si sincronizzano con l’editor.

---

## Roadmap breve

- [x] Hub multi-sezione + J.A.R.V.I.S + M.I.N.E + Code + Design
- [x] Naming Omnicore / cinque agenti (README + themes)
- [ ] Route e UI **E.D.I.T** (social)
- [ ] Rinominare path UI `/code` → allineamento P.R.O.M.P.T, `/design` → A.R.T (opzionale)
- [ ] Provider free documentati (Groq, OpenRouter) in settings
- [ ] Collegamento opzionale a [omnicore-agent](https://github.com/zema-tech/omnicore-agent) self-host

---

## Licenza / uso

Progetto personale di [zema-tech](https://github.com/zema-tech). Repo privato; uso e distribuzione a discrezione dell’autore.
