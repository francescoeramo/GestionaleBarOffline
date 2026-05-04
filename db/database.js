// ============================================================
//  database.js — Inizializzazione sql.js + persistenza OPFS
// ============================================================

(async function initDB() {
  // Carica sql.js (già incluso via CDN in index.html)
  const SQL = await initSqlJs({
    locateFile: file =>
      `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
  });

  let db;
  const DB_KEY = 'bar_gestionale_db';

  // Prova a caricare il DB salvato da IndexedDB
  async function loadFromIDB() {
    return new Promise((resolve) => {
      const req = indexedDB.open('BarGestionaleDB', 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore('db');
      req.onsuccess = e => {
        const idb = e.target.result;
        const tx  = idb.transaction('db', 'readonly');
        const get = tx.objectStore('db').get(DB_KEY);
        get.onsuccess = () => resolve(get.result || null);
        get.onerror   = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  }

  // Salva il DB in IndexedDB
  window.saveDB = async function () {
    const data = db.export();
    return new Promise((resolve) => {
      const req = indexedDB.open('BarGestionaleDB', 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore('db');
      req.onsuccess = e => {
        const idb = e.target.result;
        const tx  = idb.transaction('db', 'readwrite');
        tx.objectStore('db').put(data, DB_KEY);
        tx.oncomplete = () => resolve();
      };
    });
  };

  // Carica o crea il DB
  const saved = await loadFromIDB();
  if (saved) {
    db = new SQL.Database(saved);
  } else {
    db = new SQL.Database();
    db.run(window.DB_SCHEMA);
    await window.saveDB();
  }

  // Assicura che lo schema sia aggiornato (migrazioni additive)
  db.run(window.DB_SCHEMA);

  // Espone il DB globalmente
  window._db = db;

  // Auto-save ogni 30 secondi
  setInterval(window.saveDB, 30000);

  // Salva prima di chiudere la pagina
  window.addEventListener('beforeunload', window.saveDB);

  // Segnala che il DB è pronto
  window.dispatchEvent(new Event('db-ready'));
  console.log('[DB] SQLite offline pronto.');
})();
