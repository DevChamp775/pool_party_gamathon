import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'poolparty.db');
export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA synchronous = NORMAL;

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT 'POOL PARTY — Pixel Forge',
    status TEXT NOT NULL DEFAULT 'LOBBY' CHECK (status IN ('LOBBY','IN_PROGRESS','PAUSED','ENDED')),
    player_xcode TEXT NOT NULL,
    admin_xcode_hash TEXT NOT NULL,
    config_json TEXT NOT NULL,
    current_round_no INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    started_at INTEGER,
    ended_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_lower TEXT NOT NULL,
    join_code TEXT NOT NULL UNIQUE,
    seed_order INTEGER NOT NULL,
    avatar_id INTEGER NOT NULL DEFAULT 1,
    token_version INTEGER NOT NULL DEFAULT 1,
    is_online INTEGER NOT NULL DEFAULT 0,
    last_seen_at INTEGER,
    created_at INTEGER NOT NULL,
    UNIQUE(session_id, name_lower)
  );

  CREATE TABLE IF NOT EXISTS team_wallets (
    team_id INTEGER PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL CHECK (balance >= 0),
    initial_balance INTEGER NOT NULL DEFAULT 0,
    total_contributed INTEGER NOT NULL DEFAULT 0,
    total_rewards INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS game_rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    round_no INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','DISCUSSION','OPEN','CLOSED','SETTLED')),
    opened_at INTEGER,
    deadline_at INTEGER,
    closed_at INTEGER,
    settled_at INTEGER,
    pool_total INTEGER,
    carry_in INTEGER NOT NULL DEFAULT 0,
    carry_out INTEGER NOT NULL DEFAULT 0,
    reward_total INTEGER,
    base_share INTEGER,
    remainder_tokens INTEGER,
    dust_x100 INTEGER,
    cooperation_pct REAL,
    UNIQUE(session_id, round_no)
  );

  CREATE TABLE IF NOT EXISTS contributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round_id INTEGER NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount >= 0),
    is_auto INTEGER NOT NULL DEFAULT 0,
    submitted_at INTEGER NOT NULL,
    UNIQUE(round_id, team_id)
  );

  CREATE TABLE IF NOT EXISTS reward_distributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round_id INTEGER NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    previous_balance INTEGER NOT NULL,
    contribution_amount INTEGER NOT NULL,
    base_share INTEGER NOT NULL,
    remainder_bonus INTEGER NOT NULL,
    total_reward INTEGER NOT NULL,
    new_balance INTEGER NOT NULL,
    net_gain INTEGER NOT NULL,
    UNIQUE(round_id, team_id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    round_id INTEGER REFERENCES game_rounds(id) ON DELETE SET NULL,
    kind TEXT NOT NULL CHECK (kind IN ('INITIAL_GRANT','CONTRIBUTION','REWARD','ADJUSTMENT')),
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    idempotency_key TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    details_json TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL
  );

  CREATE TRIGGER IF NOT EXISTS prevent_tx_update
  BEFORE UPDATE ON transactions
  BEGIN
    SELECT RAISE(ABORT, 'Ledger transactions are append-only and immutable');
  END;

  CREATE TRIGGER IF NOT EXISTS prevent_tx_delete
  BEFORE DELETE ON transactions
  BEGIN
    SELECT RAISE(ABORT, 'Ledger transactions cannot be deleted');
  END;
`);

export function runInTransaction<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw err;
  }
}
