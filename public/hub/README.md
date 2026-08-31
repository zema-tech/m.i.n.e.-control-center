# Omnicore Hub (pre-login)

Landing page statica del Control Center.

## File

| File | Ruolo |
|------|--------|
| `index.html` | Hub Omnicore: agenti, self-host, login/signup |
| `character.jpg` | Immagine hero (opzionale) |
| `hero-web.mp4` | Video hero (opzionale) |

Se mancano i media, la pagina resta usabile (il video/immagine possono risultare vuoti).

## Media (da aggiungere)

Carica in questa cartella dal progetto locale:

- `character.jpg`
- `hero-web.mp4`

Sorgente ottimizzata in `artifacts/omnicore-hub/` (sessione di sviluppo).

## Uso

1. Apri `index.html` in un browser, oppure
2. Servi `public/hub/` come static root (es. `npx serve public/hub`)

**Self-host agent:** https://github.com/zema-tech/omnicore-agent

Login/signup in pagina è **demo locale** (localStorage). In produzione collegare al backend del Control Center.
