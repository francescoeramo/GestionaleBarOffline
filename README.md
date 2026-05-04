# Bar Gestionale — Offline PWA

Versione completamente offline dell'app. Nessun server Python, nessun backend.
Funziona direttamente nel browser tramite **sql.js** (SQLite in WebAssembly) e **Service Worker**.

## Come funziona

```
Browser
  └── Service Worker  → cache offline di tutti i file statici
  └── sql.js (WASM)   → SQLite che gira nel browser
  └── db/api.js       → sostituisce FastAPI, risponde alle stesse chiamate api()
  └── IndexedDB       → persiste il database tra una sessione e l'altra
```

I dati sono salvati in **IndexedDB** sul dispositivo. Non escono mai dal browser.
Auto-save ogni 30 secondi + al chiusura della pagina.

## Avvio

### Sviluppo locale
```bash
# Qualsiasi server statico va bene
npx serve .
# oppure
python3 -m http.server 8080
```
Apri `http://localhost:8080`

### Produzione (su qualsiasi hosting statico)
Carica tutti i file su:
- GitHub Pages
- Netlify
- Vercel
- Qualsiasi web server nginx/apache

### Su tablet Android (senza internet)
1. Apri l'app almeno una volta con connessione → il Service Worker scarica tutto
2. Da quel momento funziona **completamente offline**
3. Chrome → menu ⋮ → *Aggiungi a schermata Home* per installarla come app

## Struttura
```
├── index.html          # Entry point
├── sw.js               # Service Worker (cache offline)
├── app.js              # Router + toast + modal
├── manifest.json       # PWA manifest
├── style.css           # Design system
├── style_supplement.css
├── db/
│   ├── schema.js       # Definizione tabelle SQL
│   ├── database.js     # Init sql.js + persistenza IndexedDB
│   └── api.js          # Layer API (sostituisce FastAPI)
└── views/
    ├── tavoli.js
    ├── pos.js
    ├── menu.js
    ├── ingredienti.js
    ├── magazzino.js
    ├── fornitori.js
    ├── storico.js
    └── print.js
```

## Differenze rispetto alla versione con server
| Funzionalità | Server (originale) | Offline (questa) |
|---|---|---|
| Backend | Python + FastAPI | Nessuno |
| Database | SQLite su disco | SQLite in browser (IndexedDB) |
| Backup | Script bash + cron | Export manuale dal browser |
| Multi-device sync | Sì (tutti vedono lo stesso DB) | No (ogni dispositivo ha il suo DB) |
| Installazione | Richiede Linux + Python | Basta aprire il browser |
