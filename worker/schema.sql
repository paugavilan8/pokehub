-- Base de datos de avisos de stock (Cloudflare D1).
-- Crear: npx wrangler d1 execute pokehub-alerts --remote --file=worker/schema.sql

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,            -- "<tienda>:<id en la tienda>"
  shop TEXT NOT NULL,
  name TEXT NOT NULL,
  search TEXT NOT NULL,           -- nombre en minúsculas y sin tildes, para buscar
  url TEXT NOT NULL,
  image TEXT,
  price REAL,
  available INTEGER NOT NULL,
  kind TEXT,
  lang TEXT,
  first_seen TEXT NOT NULL,
  last_change TEXT NOT NULL       -- última vez que cambió el stock o el precio
);
CREATE INDEX IF NOT EXISTS products_shop ON products (shop);

CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,     -- para confirmar y darse de baja sin contraseña
  lang TEXT NOT NULL DEFAULT 'es',
  created_at TEXT NOT NULL,
  confirmed_at TEXT               -- NULL hasta que confirma el correo (doble confirmación)
);

CREATE TABLE IF NOT EXISTS watches (
  subscriber_id INTEGER NOT NULL REFERENCES subscribers (id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  notified_at TEXT,
  PRIMARY KEY (subscriber_id, product_id)
);
CREATE INDEX IF NOT EXISTS watches_product ON watches (product_id);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS shop_state (
  shop TEXT PRIMARY KEY,
  checked_at TEXT,
  ok INTEGER,
  error TEXT,
  products INTEGER
);
