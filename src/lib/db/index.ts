import Database from 'better-sqlite3';
import bcryptjs from 'bcryptjs';
import path from 'path';

// ============================================
// SQLite Database - Singleton
// ============================================

const DB_PATH = path.join(process.cwd(), 'data', 'db', 'finlab.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema(db);
    seedDefaultAdmin(db);
  }
  return db;
}

// ============================================
// Schema
// ============================================

function initializeSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT DEFAULT '',
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS api_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      symbol TEXT NOT NULL,
      request_type TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      response_status TEXT NOT NULL DEFAULT 'success',
      duration_ms INTEGER,
      cached INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS suggested_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER,
      symbol TEXT NOT NULL,
      action_type TEXT NOT NULL,
      direction TEXT NOT NULL,
      title TEXT NOT NULL,
      entry_price REAL,
      stop_loss REAL,
      take_profit REAL,
      risk_reward REAL,
      confidence INTEGER,
      urgency TEXT,
      reasons TEXT,
      overall_signal_direction TEXT,
      overall_signal_score REAL,
      market_bias TEXT,
      volatility_state TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (request_id) REFERENCES api_requests(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_api_requests_user ON api_requests(user_id);
    CREATE INDEX IF NOT EXISTS idx_api_requests_timestamp ON api_requests(timestamp);
    CREATE INDEX IF NOT EXISTS idx_suggested_actions_request ON suggested_actions(request_id);
    CREATE INDEX IF NOT EXISTS idx_suggested_actions_timestamp ON suggested_actions(timestamp);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  `);
}

// ============================================
// Seed default admin
// ============================================

function seedDefaultAdmin(db: Database.Database) {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!existing) {
    const hash = bcryptjs.hashSync('password', 10);
    db.prepare('INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)').run('admin', hash, 'email@mail.com', 'admin');
    console.log('[DB] Default admin user created');
  }
}

// ============================================
// User operations
// ============================================

export interface DbUser {
  id: number;
  username: string;
  password_hash: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
  updated_at: string;
}

export function findUserByUsername(username: string): DbUser | undefined {
  return getDb().prepare('SELECT * FROM users WHERE username = ?').get(username) as DbUser | undefined;
}

export function findUserById(id: number): DbUser | undefined {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as DbUser | undefined;
}

export function getAllUsers(): Omit<DbUser, 'password_hash'>[] {
  return getDb().prepare('SELECT id, username, email, role, created_at, updated_at FROM users ORDER BY created_at DESC').all() as Omit<DbUser, 'password_hash'>[];
}

export function createUser(username: string, password: string, role: 'admin' | 'user' = 'user', email: string = ''): DbUser {
  const hash = bcryptjs.hashSync(password, 10);
  const result = getDb().prepare('INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)').run(username, hash, email, role);
  return findUserById(result.lastInsertRowid as number)!;
}

export function updateUser(id: number, data: { username?: string; password?: string; role?: 'admin' | 'user'; email?: string }): boolean {
  const user = findUserById(id);
  if (!user) return false;

  if (data.username) {
    getDb().prepare('UPDATE users SET username = ?, updated_at = datetime(\'now\') WHERE id = ?').run(data.username, id);
  }
  if (data.password) {
    const hash = bcryptjs.hashSync(data.password, 10);
    getDb().prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(hash, id);
  }
  if (data.role) {
    getDb().prepare('UPDATE users SET role = ?, updated_at = datetime(\'now\') WHERE id = ?').run(data.role, id);
  }
  if (data.email !== undefined) {
    getDb().prepare('UPDATE users SET email = ?, updated_at = datetime(\'now\') WHERE id = ?').run(data.email, id);
  }
  return true;
}

export function deleteUser(id: number): boolean {
  const result = getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
  return result.changes > 0;
}

export function verifyPassword(plaintext: string, hash: string): boolean {
  return bcryptjs.compareSync(plaintext, hash);
}

// ============================================
// Session operations
// ============================================

export function createSession(userId: number): string {
  const { v4: uuidv4 } = require('uuid');
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h
  getDb().prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionId, userId, expiresAt);
  return sessionId;
}

export function getSession(sessionId: string): { user_id: number; expires_at: string } | undefined {
  const session = getDb().prepare('SELECT user_id, expires_at FROM sessions WHERE id = ?').get(sessionId) as { user_id: number; expires_at: string } | undefined;
  if (!session) return undefined;

  if (new Date(session.expires_at) < new Date()) {
    getDb().prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    return undefined;
  }
  return session;
}

export function deleteSession(sessionId: string): void {
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function cleanExpiredSessions(): void {
  getDb().prepare('DELETE FROM sessions WHERE expires_at < datetime(\'now\')').run();
}

// ============================================
// API Request logging
// ============================================

export function logApiRequest(data: {
  userId?: number;
  symbol: string;
  requestType: string;
  responseStatus?: string;
  durationMs?: number;
  cached?: boolean;
}): number {
  const result = getDb().prepare(`
    INSERT INTO api_requests (user_id, symbol, request_type, response_status, duration_ms, cached)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    data.userId || null,
    data.symbol,
    data.requestType,
    data.responseStatus || 'success',
    data.durationMs || null,
    data.cached ? 1 : 0
  );
  return result.lastInsertRowid as number;
}

// ============================================
// Suggested Actions logging
// ============================================

export function logSuggestedActions(requestId: number, data: {
  symbol: string;
  actions: Array<{
    actionType: string;
    direction: string;
    title: string;
    entryPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    riskReward?: number;
    confidence?: number;
    urgency?: string;
    reasons?: string[];
  }>;
  overallSignalDirection: string;
  overallSignalScore: number;
  marketBias: string;
  volatilityState: string;
}): void {
  const stmt = getDb().prepare(`
    INSERT INTO suggested_actions (
      request_id, symbol, action_type, direction, title,
      entry_price, stop_loss, take_profit, risk_reward,
      confidence, urgency, reasons,
      overall_signal_direction, overall_signal_score,
      market_bias, volatility_state
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = getDb().transaction((actions: typeof data.actions) => {
    for (const action of actions) {
      stmt.run(
        requestId,
        data.symbol,
        action.actionType,
        action.direction,
        action.title,
        action.entryPrice || null,
        action.stopLoss || null,
        action.takeProfit || null,
        action.riskReward || null,
        action.confidence || null,
        action.urgency || null,
        action.reasons ? JSON.stringify(action.reasons) : null,
        data.overallSignalDirection,
        data.overallSignalScore,
        data.marketBias,
        data.volatilityState
      );
    }
  });

  insertMany(data.actions);
}

// ============================================
// History queries
// ============================================

export function getRecentRequests(limit = 50): unknown[] {
  return getDb().prepare(`
    SELECT r.*, u.username
    FROM api_requests r
    LEFT JOIN users u ON r.user_id = u.id
    ORDER BY r.timestamp DESC
    LIMIT ?
  `).all(limit);
}

export function getRecentActions(limit = 100): unknown[] {
  return getDb().prepare(`
    SELECT sa.*, r.symbol as req_symbol, r.timestamp as req_timestamp
    FROM suggested_actions sa
    LEFT JOIN api_requests r ON sa.request_id = r.id
    ORDER BY sa.timestamp DESC
    LIMIT ?
  `).all(limit);
}

export function getActionStats(): unknown {
  return getDb().prepare(`
    SELECT
      COUNT(*) as total_actions,
      COUNT(CASE WHEN direction = 'LONG' THEN 1 END) as long_count,
      COUNT(CASE WHEN direction = 'SHORT' THEN 1 END) as short_count,
      COUNT(CASE WHEN direction = 'ESPERAR' THEN 1 END) as wait_count,
      ROUND(AVG(confidence), 1) as avg_confidence,
      ROUND(AVG(risk_reward), 2) as avg_risk_reward
    FROM suggested_actions
    WHERE timestamp > datetime('now', '-7 days')
  `).get();
}
