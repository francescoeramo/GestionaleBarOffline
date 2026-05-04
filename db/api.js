// ============================================================
//  api.js — Layer che sostituisce le chiamate a FastAPI
//  Espone window.api(method, path, body) identico all'originale
//  ma lavora direttamente su sql.js in-memory
// ============================================================

// Utilità DB
function dbAll(sql, params = []) {
  const stmt = window._db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function dbGet(sql, params = []) {
  return dbAll(sql, params)[0] || null;
}

function dbRun(sql, params = []) {
  window._db.run(sql, params);
  return window._db.exec('SELECT last_insert_rowid() as id')[0]?.values[0][0];
}

// Helper: converti snake_case row in oggetto JS pulito
function row(r) { return r ? { ...r } : null; }

// Mappa: METHOD + path pattern → handler
const ROUTES = [];

function route(method, pattern, handler) {
  ROUTES.push({ method, pattern: new RegExp('^' + pattern + '$'), handler });
}

// ── CATEGORIES ───────────────────────────────────────────────
route('GET',  '/categories/', () => dbAll('SELECT * FROM categories ORDER BY sort_order, name'));
route('POST', '/categories/', (_, b) => {
  const id = dbRun('INSERT INTO categories (name, sort_order) VALUES (?,?)', [b.name, b.sort_order||0]);
  return dbGet('SELECT * FROM categories WHERE id=?', [id]);
});
route('PUT',  '/categories/(\\d+)', (m, b) => {
  dbRun('UPDATE categories SET name=?, sort_order=? WHERE id=?', [b.name, b.sort_order||0, +m[1]]);
  return dbGet('SELECT * FROM categories WHERE id=?', [+m[1]]);
});
route('DELETE', '/categories/(\\d+)', (m) => {
  dbRun('DELETE FROM categories WHERE id=?', [+m[1]]); return null;
});

// ── PRODUCTS ──────────────────────────────────────────────────
route('GET',  '/products/', () => dbAll('SELECT * FROM products WHERE is_active=1 ORDER BY name'));
route('GET',  '/products/(\\d+)', (m) => row(dbGet('SELECT * FROM products WHERE id=?', [+m[1]])));
route('POST', '/products/', (_, b) => {
  const id = dbRun(
    'INSERT INTO products (name,category_id,sale_price,cost_price,description,allow_mods) VALUES (?,?,?,?,?,?)',
    [b.name, b.category_id||null, b.sale_price, b.cost_price||0, b.description||null, b.allow_mods?1:0]
  );
  return dbGet('SELECT * FROM products WHERE id=?', [id]);
});
route('PUT',  '/products/(\\d+)', (m, b) => {
  dbRun(
    'UPDATE products SET name=?,category_id=?,sale_price=?,cost_price=?,description=?,allow_mods=?,is_active=? WHERE id=?',
    [b.name, b.category_id||null, b.sale_price, b.cost_price||0, b.description||null, b.allow_mods?1:0, b.is_active!==false?1:0, +m[1]]
  );
  return dbGet('SELECT * FROM products WHERE id=?', [+m[1]]);
});
route('DELETE', '/products/(\\d+)', (m) => {
  dbRun('UPDATE products SET is_active=0 WHERE id=?', [+m[1]]); return null;
});

// Ricette
route('GET',  '/products/(\\d+)/recipe', (m) =>
  dbAll('SELECT r.*, i.name as ingredient_name, i.unit FROM recipes r JOIN ingredients i ON i.id=r.ingredient_id WHERE r.product_id=?', [+m[1]])
);
route('POST', '/products/(\\d+)/recipe', (m, b) => {
  dbRun('INSERT OR REPLACE INTO recipes (product_id,ingredient_id,quantity) VALUES (?,?,?)', [+m[1], b.ingredient_id, b.quantity]);
  return dbGet('SELECT r.*, i.name as ingredient_name, i.unit FROM recipes r JOIN ingredients i ON i.id=r.ingredient_id WHERE r.product_id=? AND r.ingredient_id=?', [+m[1], b.ingredient_id]);
});
route('DELETE', '/products/(\\d+)/recipe/(\\d+)', (m) => {
  dbRun('DELETE FROM recipes WHERE product_id=? AND ingredient_id=?', [+m[1], +m[2]]); return null;
});

// ── INGREDIENTS ───────────────────────────────────────────────
route('GET',  '/ingredients/', () => dbAll('SELECT * FROM ingredients ORDER BY name'));
route('POST', '/ingredients/', (_, b) => {
  const id = dbRun('INSERT INTO ingredients (name,unit,cost_per_unit) VALUES (?,?,?)', [b.name, b.unit||'pz', b.cost_per_unit||0]);
  return dbGet('SELECT * FROM ingredients WHERE id=?', [id]);
});
route('PUT',  '/ingredients/(\\d+)', (m, b) => {
  dbRun('UPDATE ingredients SET name=?,unit=?,cost_per_unit=? WHERE id=?', [b.name, b.unit||'pz', b.cost_per_unit||0, +m[1]]);
  return dbGet('SELECT * FROM ingredients WHERE id=?', [+m[1]]);
});
route('DELETE', '/ingredients/(\\d+)', (m) => {
  dbRun('DELETE FROM ingredients WHERE id=?', [+m[1]]); return null;
});

// ── STOCK ─────────────────────────────────────────────────────
route('GET', '/stock/', () =>
  dbAll('SELECT s.*, i.name, i.unit FROM stock s JOIN ingredients i ON i.id=s.ingredient_id ORDER BY i.name')
);
route('GET', '/stock/(\\d+)', (m) =>
  row(dbGet('SELECT s.*, i.name, i.unit FROM stock s JOIN ingredients i ON i.id=s.ingredient_id WHERE s.ingredient_id=?', [+m[1]]))
);
route('POST', '/stock/move', (_, b) => {
  const ing_id = b.ingredient_id;
  let cur = dbGet('SELECT quantity FROM stock WHERE ingredient_id=?', [ing_id]);
  if (!cur) {
    dbRun('INSERT INTO stock (ingredient_id, quantity) VALUES (?,0)', [ing_id]);
    cur = { quantity: 0 };
  }
  let newQty = cur.quantity;
  if (b.type === 'load')   newQty += b.quantity;
  if (b.type === 'unload') newQty = Math.max(0, newQty - b.quantity);
  if (b.type === 'adjust') newQty = b.quantity;
  dbRun('UPDATE stock SET quantity=? WHERE ingredient_id=?', [newQty, ing_id]);
  dbRun('INSERT INTO stock_movements (ingredient_id,type,quantity,note) VALUES (?,?,?,?)', [ing_id, b.type, b.quantity, b.note||null]);
  if (b.min_threshold !== undefined && b.min_threshold !== null) {
    dbRun('UPDATE stock SET min_threshold=? WHERE ingredient_id=?', [b.min_threshold, ing_id]);
  }
  return dbGet('SELECT s.*, i.name, i.unit FROM stock s JOIN ingredients i ON i.id=s.ingredient_id WHERE s.ingredient_id=?', [ing_id]);
});
route('GET', '/stock/(\\d+)/movements', (m) =>
  dbAll('SELECT * FROM stock_movements WHERE ingredient_id=? ORDER BY created_at DESC LIMIT 50', [+m[1]])
);

// ── SUPPLIERS ─────────────────────────────────────────────────
route('GET',  '/suppliers/', () => dbAll('SELECT * FROM suppliers ORDER BY company_name'));
route('GET',  '/suppliers/(\\d+)', (m) => row(dbGet('SELECT * FROM suppliers WHERE id=?', [+m[1]])));
route('POST', '/suppliers/', (_, b) => {
  const id = dbRun('INSERT INTO suppliers (company_name,contact_name,phone,email,notes) VALUES (?,?,?,?,?)',
    [b.company_name, b.contact_name||null, b.phone||null, b.email||null, b.notes||null]);
  return dbGet('SELECT * FROM suppliers WHERE id=?', [id]);
});
route('PUT',  '/suppliers/(\\d+)', (m, b) => {
  dbRun('UPDATE suppliers SET company_name=?,contact_name=?,phone=?,email=?,notes=? WHERE id=?',
    [b.company_name, b.contact_name||null, b.phone||null, b.email||null, b.notes||null, +m[1]]);
  return dbGet('SELECT * FROM suppliers WHERE id=?', [+m[1]]);
});
route('DELETE', '/suppliers/(\\d+)', (m) => {
  dbRun('DELETE FROM suppliers WHERE id=?', [+m[1]]); return null;
});
route('GET',  '/suppliers/(\\d+)/ingredients', (m) =>
  dbAll('SELECT si.*, i.name as ingredient_name, i.unit FROM supplier_ingredients si JOIN ingredients i ON i.id=si.ingredient_id WHERE si.supplier_id=?', [+m[1]])
);
route('POST', '/suppliers/(\\d+)/ingredients', (m, b) => {
  dbRun('INSERT OR REPLACE INTO supplier_ingredients (supplier_id,ingredient_id,unit_price) VALUES (?,?,?)',
    [+m[1], b.ingredient_id, b.unit_price||0]);
  return dbGet('SELECT si.*, i.name as ingredient_name, i.unit FROM supplier_ingredients si JOIN ingredients i ON i.id=si.ingredient_id WHERE si.supplier_id=? AND si.ingredient_id=?', [+m[1], b.ingredient_id]);
});
route('DELETE', '/suppliers/(\\d+)/ingredients/(\\d+)', (m) => {
  dbRun('DELETE FROM supplier_ingredients WHERE supplier_id=? AND ingredient_id=?', [+m[1], +m[2]]); return null;
});

// ── TABLES ────────────────────────────────────────────────────
route('GET', '/tables/', () => dbAll('SELECT * FROM tables ORDER BY name'));
route('GET', '/tables/(\\d+)', (m) => row(dbGet('SELECT * FROM tables WHERE id=?', [+m[1]])));
route('POST', '/tables/', (_, b) => {
  const id = dbRun('INSERT INTO tables (name,capacity,status) VALUES (?,?,?)', [b.name, b.capacity||4, 'free']);
  return dbGet('SELECT * FROM tables WHERE id=?', [id]);
});
route('PUT',  '/tables/(\\d+)', (m, b) => {
  dbRun('UPDATE tables SET name=?,capacity=?,status=? WHERE id=?', [b.name, b.capacity||4, b.status||'free', +m[1]]);
  return dbGet('SELECT * FROM tables WHERE id=?', [+m[1]]);
});
route('PATCH', '/tables/(\\d+)/status', (m, b) => {
  dbRun('UPDATE tables SET status=? WHERE id=?', [b.status, +m[1]]);
  return dbGet('SELECT * FROM tables WHERE id=?', [+m[1]]);
});
route('DELETE', '/tables/(\\d+)', (m) => {
  dbRun('DELETE FROM tables WHERE id=?', [+m[1]]); return null;
});

// ── ORDERS ────────────────────────────────────────────────────
function buildOrder(order) {
  if (!order) return null;
  order.items = dbAll('SELECT * FROM order_items WHERE order_id=? ORDER BY id', [order.id]);
  return order;
}

route('GET',  '/orders/', (_, __, params) => {
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const p = [];
  if (params.status) { sql += ' AND status=?'; p.push(params.status); }
  if (params.date_from) { sql += ' AND date(opened_at)>=?'; p.push(params.date_from); }
  if (params.date_to)   { sql += ' AND date(opened_at)<=?'; p.push(params.date_to); }
  sql += ' ORDER BY opened_at DESC';
  return dbAll(sql, p).map(buildOrder);
});
route('GET',  '/orders/(\\d+)', (m) => buildOrder(dbGet('SELECT * FROM orders WHERE id=?', [+m[1]])));
route('POST', '/orders/', (_, b) => {
  const id = dbRun('INSERT INTO orders (table_id, covers) VALUES (?,?)', [b.table_id||null, b.covers||1]);
  if (b.table_id) dbRun('UPDATE tables SET status=? WHERE id=?', ['occupied', b.table_id]);
  return buildOrder(dbGet('SELECT * FROM orders WHERE id=?', [id]));
});
route('POST', '/orders/(\\d+)/items', (m, b) => {
  const id = dbRun(
    'INSERT INTO order_items (order_id,item_type,product_id,product_name_snapshot,unit_price_snapshot,quantity,notes) VALUES (?,?,?,?,?,?,?)',
    [+m[1], b.item_type||'menu', b.product_id||null, b.product_name_snapshot, b.unit_price_snapshot, b.quantity||1, b.notes||null]
  );
  return dbGet('SELECT * FROM order_items WHERE id=?', [id]);
});
route('DELETE', '/orders/(\\d+)/items/(\\d+)', (m) => {
  dbRun('UPDATE order_items SET status=? WHERE id=? AND order_id=?', ['cancelled', +m[2], +m[1]]); return null;
});
route('PATCH', '/orders/(\\d+)/close', (m, b) => {
  const now = new Date().toLocaleString('sv').replace('T', ' ');
  dbRun('UPDATE orders SET status=?,discount_type=?,discount_value=?,closed_at=? WHERE id=?',
    ['closed', b.discount_type||null, b.discount_value||0, now, +m[1]]);
  const o = dbGet('SELECT * FROM orders WHERE id=?', [+m[1]]);
  if (o?.table_id) dbRun('UPDATE tables SET status=? WHERE id=?', ['free', o.table_id]);
  return buildOrder(o);
});
route('PATCH', '/orders/(\\d+)/cancel', (m) => {
  const now = new Date().toLocaleString('sv').replace('T', ' ');
  dbRun('UPDATE orders SET status=?,closed_at=? WHERE id=?', ['cancelled', now, +m[1]]);
  const o = dbGet('SELECT * FROM orders WHERE id=?', [+m[1]]);
  if (o?.table_id) dbRun('UPDATE tables SET status=? WHERE id=?', ['free', o.table_id]);
  return null;
});

// ── PAYMENTS ──────────────────────────────────────────────────
route('POST', '/payments/', (_, b) => {
  const id = dbRun('INSERT INTO payments (order_id,method,amount,cash_given,voucher_code) VALUES (?,?,?,?,?)',
    [b.order_id, b.method, b.amount, b.cash_given||null, b.voucher_code||null]);
  // Scala automaticamente il magazzino in base alle ricette
  const items = dbAll('SELECT * FROM order_items WHERE order_id=? AND status=\'active\'', [b.order_id]);
  items.forEach(item => {
    if (!item.product_id) return;
    const recipe = dbAll('SELECT * FROM recipes WHERE product_id=?', [item.product_id]);
    recipe.forEach(r => {
      const qty = r.quantity * item.quantity;
      const cur = dbGet('SELECT quantity FROM stock WHERE ingredient_id=?', [r.ingredient_id]);
      if (cur) {
        const newQty = Math.max(0, cur.quantity - qty);
        dbRun('UPDATE stock SET quantity=? WHERE ingredient_id=?', [newQty, r.ingredient_id]);
        dbRun('INSERT INTO stock_movements (ingredient_id,type,quantity,note) VALUES (?,?,?,?)',
          [r.ingredient_id, 'unload', qty, `Auto: ordine #${b.order_id}`]);
      }
    });
  });
  window.saveDB();
  return dbGet('SELECT * FROM payments WHERE id=?', [id]);
});
route('GET', '/payments/order/(\\d+)', (m) =>
  dbAll('SELECT * FROM payments WHERE order_id=? ORDER BY paid_at', [+m[1]])
);

// ── ROUTER PRINCIPALE ─────────────────────────────────────────
// Attende che il DB sia pronto prima di sostituire window.api
function registerApi() {
  window.api = async function(method, path, body = null) {
    // Estrai query string dal path
    const [cleanPath, qs] = path.split('?');
    const params = Object.fromEntries(new URLSearchParams(qs || ''));

    for (const r of ROUTES) {
      if (r.method !== method.toUpperCase()) continue;
      const m = cleanPath.match(r.pattern);
      if (m) {
        try {
          const result = r.handler(m, body || {}, params);
          // Auto-salva dopo ogni scrittura
          if (method !== 'GET') await window.saveDB();
          return result ?? null;
        } catch (e) {
          throw new Error(e.message || 'Errore DB');
        }
      }
    }
    throw new Error(`Route non trovata: ${method} ${path}`);
  };
  console.log('[API] Layer offline registrato.');
}

if (window._db) {
  registerApi();
} else {
  window.addEventListener('db-ready', registerApi);
}
