// ============================================================
//  Schema SQL — Bar Gestionale Offline
//  Ricreazione delle tabelle che erano in Python/SQLAlchemy
// ============================================================

window.DB_SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  sale_price   REAL NOT NULL DEFAULT 0,
  cost_price   REAL DEFAULT 0,
  description  TEXT,
  is_active    INTEGER NOT NULL DEFAULT 1,
  allow_mods   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ingredients (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL UNIQUE,
  unit         TEXT NOT NULL DEFAULT 'pz',
  cost_per_unit REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recipes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity      REAL NOT NULL DEFAULT 1,
  UNIQUE(product_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS stock (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ingredient_id  INTEGER NOT NULL UNIQUE REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity       REAL NOT NULL DEFAULT 0,
  min_threshold  REAL DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK(type IN ('load','unload','adjust')),
  quantity      REAL NOT NULL,
  note          TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS suppliers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  phone        TEXT,
  email        TEXT,
  notes        TEXT
);

CREATE TABLE IF NOT EXISTS supplier_ingredients (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id   INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  unit_price    REAL DEFAULT 0,
  UNIQUE(supplier_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS tables (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  name     TEXT NOT NULL UNIQUE,
  capacity INTEGER DEFAULT 4,
  status   TEXT NOT NULL DEFAULT 'free' CHECK(status IN ('free','occupied','reserved'))
);

CREATE TABLE IF NOT EXISTS orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id     INTEGER REFERENCES tables(id) ON DELETE SET NULL,
  covers       INTEGER DEFAULT 1,
  status       TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed','cancelled')),
  discount_type  TEXT CHECK(discount_type IN ('percent','flat') OR discount_type IS NULL),
  discount_value REAL DEFAULT 0,
  opened_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  closed_at    TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id              INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_type             TEXT NOT NULL DEFAULT 'menu' CHECK(item_type IN ('menu','free')),
  product_id            INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name_snapshot TEXT NOT NULL,
  unit_price_snapshot   REAL NOT NULL,
  quantity              INTEGER NOT NULL DEFAULT 1,
  notes                 TEXT,
  status                TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled'))
);

CREATE TABLE IF NOT EXISTS payments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method       TEXT NOT NULL CHECK(method IN ('cash','card','voucher')),
  amount       REAL NOT NULL,
  cash_given   REAL,
  voucher_code TEXT,
  paid_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Tavoli di default se la tabella è vuota
INSERT OR IGNORE INTO tables (name, capacity) VALUES
  ('Tavolo 1', 4), ('Tavolo 2', 4), ('Tavolo 3', 4), ('Tavolo 4', 4),
  ('Tavolo 5', 4), ('Tavolo 6', 6), ('Tavolo 7', 6), ('Tavolo 8', 2),
  ('Banco', 8);
`;
