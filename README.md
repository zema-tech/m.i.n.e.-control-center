# M.I.N.E. Control Center

Crea un pannello admin per server Minecraft chiamato M.I.N.E (Minecraft Intelligent Network Engine). In cui ia mi aiuta a migliorare e gestire server Minecraft su falix ti passerò chiavj api dopo



Design:



Colori: verde neon 

#00ff41 su sfondo nero 

#0a0a0a, stile Matrix/terminal

Font monospace per i log, font moderno per i titoli

Dark theme totale, niente colori chiari

Stile cyberpunk/hacker.                                                                                Sezioni del pannello:

Login con password singola hashata con bcrypt, salvata in variabile d'ambiente (non nel codice)

Token JWT con scadenza 24 ore per la sessione

Rate limiting sul login — blocca per 15 minuti dopo 5 tentativi falliti

Tutte le chiamate API passano da un backend Node.js, il frontend non tocca mai le API key direttamente

HTTPS obbligatorio (Lovable deploya su Vercel che lo gestisce automaticamente)

Headers di sicurezza: CSP, X-Frame-Options, HSTS

Log di ogni azione eseguita sul server con timestamp

Dashboard — status server (online/offline), giocatori online, RAM, CPU, TPS

Log Viewer — visualizza log del server in tempo reale, errori evidenziati in rosso

IA Assistant — chat con IA (Groq API) che legge i log, suggerisce fix in italiano, io confermo prima che agisca

Plugin Manager — lista plugin installati, IA configura i file YAML

Console — input per inviare comandi diretti al server

File Manager — upload mappe, schematic, resource pack

Performance — grafici TPS, lag, memoria nel tempo (per dati e azioni che riguardano il server ti devo dare chiave api di falix ) Contesto:



È un pannello personale per gestire UN solo server Minecraft hostato su Falix

Non serve multi-server, non serve registrazione utenti

Accesso singolo con password localeStack tecnico:



React + Tailwind

Groq API per IA (chiave inserita dall'utente nelle impostazioni)

Falix API per controllo server (chiave inserita dall'utente nelle impostazioni)

API key mai hardcodate, sempre inserite dall'utente nel pannello impostazioni

Lingua: italiano

Responsive per ogni dispositivo 



Note importanti:



L'IA suggerisce sempre, io confermo prima di fare azioni

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a08747ed-d009-4084-8e55-286cd368f219).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
