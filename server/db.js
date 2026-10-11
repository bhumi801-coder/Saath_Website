import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = process.env.DB_FILE || path.join(__dirname, 'saath.db');

export const db = new Database(file);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Bump when the seed data changes in a way old databases cannot be migrated to.
export const DATA_VERSION = 2;

export function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS societies (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      name     TEXT NOT NULL,
      area     TEXT NOT NULL,
      city     TEXT NOT NULL,
      state    TEXT NOT NULL DEFAULT 'Uttar Pradesh',
      flats    INTEGER NOT NULL DEFAULT 0,
      added_by_resident INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      phone         TEXT,
      society_id    INTEGER NOT NULL REFERENCES societies(id),
      flat          TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS services (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      slug          TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      tagline       TEXT NOT NULL,
      unit_label    TEXT NOT NULL,
      partner       TEXT NOT NULL,
      regular_price INTEGER NOT NULL,
      includes      TEXT NOT NULL            -- JSON array of strings
    );

    CREATE TABLE IF NOT EXISTS groups (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      society_id     INTEGER NOT NULL REFERENCES societies(id),
      service_id     INTEGER NOT NULL REFERENCES services(id),
      description    TEXT NOT NULL DEFAULT '',
      scheduled_date TEXT NOT NULL,           -- YYYY-MM-DD (India time)
      time_slot      TEXT NOT NULL DEFAULT '9-12', -- arrival window, see TIME_SLOTS in index.js
      target         INTEGER NOT NULL,        -- flats needed to unlock the price
      group_price    INTEGER NOT NULL,        -- per unit, once unlocked
      cancelled      INTEGER NOT NULL DEFAULT 0,
      created_by     INTEGER NOT NULL REFERENCES users(id),
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS memberships (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      units      INTEGER NOT NULL DEFAULT 1,  -- number of ACs / cars / sofas
      note       TEXT NOT NULL DEFAULT '',    -- parking bay, landmark, access instructions
      payment_method TEXT NOT NULL DEFAULT 'on_service', -- 'on_service' | 'online'
      payment_status TEXT NOT NULL DEFAULT 'pending',    -- 'pending' | 'paid' | 'refunded'
      amount_paid    INTEGER NOT NULL DEFAULT 0,
      paid_at        TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (group_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      membership_id     INTEGER NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
      user_id           INTEGER NOT NULL REFERENCES users(id),
      provider          TEXT NOT NULL,                 -- 'razorpay' | 'demo'
      provider_order_id TEXT NOT NULL UNIQUE,
      provider_payment_id TEXT,
      amount            INTEGER NOT NULL,              -- rupees
      status            TEXT NOT NULL DEFAULT 'created', -- 'created' | 'paid' | 'failed'
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      paid_at           TEXT
    );

    CREATE TABLE IF NOT EXISTS comments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      body       TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_groups_society ON groups(society_id, scheduled_date);
    CREATE INDEX IF NOT EXISTS idx_members_group  ON memberships(group_id);
    CREATE INDEX IF NOT EXISTS idx_comments_group ON comments(group_id);
    CREATE INDEX IF NOT EXISTS idx_payments_member ON payments(membership_id);

    -- ---- Service Partner (provider) system -------------------------------------
    -- Additive only: these tables are created if missing and never touch customer data.
    CREATE TABLE IF NOT EXISTS providers (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      phone         TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','suspended')),
      is_demo       INTEGER NOT NULL DEFAULT 0,    -- 1 = test account made in a demo/dev environment
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS provider_services (
      provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
      service_id  INTEGER NOT NULL REFERENCES services(id),
      PRIMARY KEY (provider_id, service_id)
    );

    CREATE TABLE IF NOT EXISTS provider_areas (
      provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
      city        TEXT NOT NULL,                   -- matches societies.city
      PRIMARY KEY (provider_id, city)
    );

    -- One row per group that has a provider. UNIQUE(group_id) is the hard guarantee that a job
    -- can never belong to two providers, even if two accept at the same moment.
    CREATE TABLE IF NOT EXISTS provider_assignments (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id     INTEGER NOT NULL UNIQUE REFERENCES groups(id),
      provider_id  INTEGER NOT NULL REFERENCES providers(id),
      status       TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted','completed','cancelled')),
      accepted_at  TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      cancelled_at TEXT,
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Append-only history of what providers did with a job.
    CREATE TABLE IF NOT EXISTS provider_job_events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id    INTEGER NOT NULL REFERENCES groups(id),
      provider_id INTEGER REFERENCES providers(id),   -- NULL when an admin acts on a job
      action      TEXT NOT NULL CHECK (action IN ('accepted','rejected','withdrawn','completed','cancelled','released')),
      note        TEXT NOT NULL DEFAULT '',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admins (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ---- Notifications and password reset (additive, safe on an existing database) ---------
    -- Everything that was sent (or tried) over WhatsApp / SMS / email. Reset codes are never stored here.
    CREATE TABLE IF NOT EXISTS notification_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      kind       TEXT NOT NULL,                 -- e.g. job_available, password_reset
      channel    TEXT NOT NULL,                 -- whatsapp | sms | email
      to_addr    TEXT NOT NULL,
      status     TEXT NOT NULL,                 -- sent | console | failed | skipped
      error      TEXT NOT NULL DEFAULT '',
      body       TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- The popup a service partner sees inside the website.
    CREATE TABLE IF NOT EXISTS provider_notifications (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
      kind        TEXT NOT NULL,
      title       TEXT NOT NULL,
      body        TEXT NOT NULL,
      group_id    INTEGER,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      read_at     TEXT
    );

    -- "Send this only once" markers (for example: tell partners about an unlocked group one time).
    CREATE TABLE IF NOT EXISTS notify_sent (
      key        TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Forgot-password codes. Only a keyed hash of the 6-digit code is stored.
    CREATE TABLE IF NOT EXISTS password_resets (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      role       TEXT NOT NULL CHECK (role IN ('customer','provider')),
      account_id INTEGER NOT NULL,
      code_hash  TEXT NOT NULL,
      attempts   INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER NOT NULL,              -- unix seconds
      used_at    INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pnotif_provider ON provider_notifications(provider_id, read_at);
    CREATE INDEX IF NOT EXISTS idx_resets_account  ON password_resets(role, account_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_assign_provider ON provider_assignments(provider_id, status);
    CREATE INDEX IF NOT EXISTS idx_events_group    ON provider_job_events(group_id, provider_id);
    CREATE INDEX IF NOT EXISTS idx_pareas_city     ON provider_areas(city);
  `);

  // Light migrations so a database made by an older version keeps working.
  const addColumn = (table, column, ddl) => {
    const has = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
    if (!has) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  };
  addColumn('societies', 'state', `TEXT NOT NULL DEFAULT 'Uttar Pradesh'`);
  addColumn('societies', 'added_by_resident', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('groups', 'time_slot', `TEXT NOT NULL DEFAULT '9-12'`);
  addColumn('memberships', 'note', `TEXT NOT NULL DEFAULT ''`);
  addColumn('memberships', 'payment_method', `TEXT NOT NULL DEFAULT 'on_service'`);
  addColumn('memberships', 'payment_status', `TEXT NOT NULL DEFAULT 'pending'`);
  addColumn('memberships', 'amount_paid', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('memberships', 'paid_at', 'TEXT');
  // Goes up by one on every password reset. Login tokens carry the number they were made with, so a
  // reset logs out every older session of that account.
  addColumn('users', 'pw_version', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('providers', 'pw_version', 'INTEGER NOT NULL DEFAULT 0');
  try {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_societies_unique ON societies(name, area, city)');
  } catch { /* duplicates in an old database: skip the index */ }
}

createSchema();
