import express from 'express';
import cors from 'cors';
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: number;
  }
}

const app = express();
const PORT = Number(process.env.PORT) || 8000;
const DB_PATH = path.join(__dirname, 'app.db');

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use((req: any, res: any, next: any) => {
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('BODY:', req.path, JSON.stringify(req.body));
  }
  next();
});

let db: any;

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

async function init() {
  const sqlLib = await initSqlJs({
    locateFile: (file: string) => path.resolve(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
  });
  db = new sqlLib.Database();
  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try { db.run('ALTER TABLE users ADD COLUMN full_name TEXT'); } catch {}

  db.run(`
    CREATE TABLE IF NOT EXISTS lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      owner_id INTEGER NOT NULL REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS list_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id INTEGER NOT NULL REFERENCES lists(id),
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      completed INTEGER DEFAULT 0,
      starred INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS list_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id INTEGER NOT NULL REFERENCES lists(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      invited_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(list_id, user_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      expires_at DATETIME NOT NULL
    )
  `);

  function authenticate(req: any, res: any, next: any) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const token = authHeader.substring(7);
    const stmt = db.prepare('SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime("now")');
    const rows = allRows(stmt, [token]);
    stmt.free();
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.userId = rows[0].user_id;
    next();
  }

  function hasListAccess(listId: number, userId: number): boolean {
    const stmt = db.prepare('SELECT 1 FROM lists WHERE id = ? AND owner_id = ? UNION SELECT 1 FROM list_members WHERE list_id = ? AND user_id = ? LIMIT 1');
    const row: any = stmt.get([listId, userId, listId, userId]);
    stmt.free();
    return Array.isArray(row) && row.length > 0;
  }

  function allRows(stmt: any, params: any[]): any[] {
    stmt.bind(params);
    const rows: any[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.reset();
    return rows;
  }

  // ---------- auth ----------
  app.post('/api/auth/register', (req, res) => {
    const { username, email, password, fullName } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password required' });
    }
    try {
      const passwordHash = hashPassword(password);
      const stmt = db.prepare('INSERT INTO users (username, email, password_hash, full_name) VALUES (?, ?, ?, ?)');
      stmt.run([username, email, passwordHash, fullName || null]);
      stmt.free();
      const lastIdRow: any = db.prepare('SELECT last_insert_rowid() as id').get([]);
      const userId = lastIdRow[0];
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const sessStmt = db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)');
      sessStmt.run([token, userId, expiresAt]);
      sessStmt.free();
      res.json({ token, user: { id: userId, username, email, full_name: fullName || null } });
    } catch (e: any) {
      console.error('Register error:', e);
      if (e.message && e.message.includes('UNIQUE')) {
        res.status(400).json({ error: 'Username already registered' });
      } else {
        res.status(500).json({ error: 'Registration failed: ' + (e.message || 'unknown') });
      }
    }
  });

  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    const stmt = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?');
    const row: any = stmt.get([username]);
    stmt.free();
    if (!row || row[2] !== hashPassword(password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const delStmt = db.prepare('DELETE FROM sessions WHERE user_id = ?');
    delStmt.run([row[0]]);
    delStmt.free();
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const sessStmt = db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)');
    sessStmt.run([token, row[0], expiresAt]);
    sessStmt.free();
    res.json({ token, user: { id: row[0], username } });
  });

  app.post('/api/auth/logout', authenticate, (req, res) => {
    const token = (req.headers.authorization as string).substring(7);
    const stmt = db.prepare('DELETE FROM sessions WHERE token = ?');
    stmt.run([token]);
    stmt.free();
    res.json({ ok: true });
  });

  app.get('/api/auth/check-username', (req, res) => {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }
    const stmt = db.prepare('SELECT id FROM users WHERE username = ?');
    const row: any = stmt.get([username]);
    stmt.free();
    res.json({ exists: Array.isArray(row) ? row.length > 0 : !!row });
  });

  app.get('/api/auth/me', authenticate, (req, res) => {
    const stmt = db.prepare('SELECT id, username, email, full_name FROM users WHERE id = ?');
    const row: any = stmt.get([req.userId!]);
    stmt.free();
    res.json({ user: { id: row[0], username: row[1], email: row[2], full_name: row[3] } });
  });

  // ---------- lists ----------
  app.get('/api/lists', authenticate, (req, res) => {
    const stmt = db.prepare(`
      SELECT l.id, l.name, l.created_at,
             CASE WHEN l.owner_id = ? THEN 1 ELSE 0 END as is_owner,
             (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id AND li.completed = 0) as item_count
     FROM lists l
      WHERE l.owner_id = ? OR l.id IN (SELECT list_id FROM list_members WHERE user_id = ?)
      ORDER BY l.created_at DESC
    `);
    const rows: any[] = allRows(stmt, [req.userId!, req.userId!, req.userId!]);
    stmt.free();
    res.json({ lists: rows });
  });

  app.post('/api/lists', authenticate, (req, res) => {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'List name required' });
    }
    const stmt = db.prepare('INSERT INTO lists (name, owner_id) VALUES (?, ?)');
    stmt.run([name, req.userId!]);
    const lastIdRow: any = db.prepare('SELECT last_insert_rowid() as id').get([]);
    const listId = lastIdRow[0];
    const memberStmt = db.prepare('INSERT INTO list_members (list_id, user_id, invited_by) VALUES (?, ?, ?)');
    memberStmt.run([listId, req.userId!, req.userId!]);
    memberStmt.free();
    res.json({ id: listId, name, owner_id: req.userId!, is_owner: true });
  });

  app.get('/api/lists/:id/items', authenticate, (req, res) => {
    const listId = Number(req.params.id);
    if (!hasListAccess(listId, req.userId!)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const stmt = db.prepare('SELECT * FROM list_items WHERE list_id = ? ORDER BY starred DESC, completed ASC, created_at DESC');
    const rows: any[] = allRows(stmt, [listId]);
    stmt.free();
    res.json({ items: rows });
  });

  app.post('/api/lists/:id/items', authenticate, (req, res) => {
    const listId = Number(req.params.id);
    if (!hasListAccess(listId, req.userId!)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { name, created_by } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Item name required' });
    }
    const stmt = db.prepare('INSERT INTO list_items (list_id, name, created_by) VALUES (?, ?, ?)');
    stmt.run([listId, name, created_by || null]);
    const lastIdRow: any = db.prepare('SELECT last_insert_rowid() as id').get([]);
    const itemId = lastIdRow[0];
    const lastIdStmt = db.prepare('SELECT * FROM list_items WHERE id = ?');
    const item: any = lastIdStmt.get([itemId]);
    lastIdStmt.free();
    res.json({ item });
  });

  app.delete('/api/lists/:id/items/:itemId', authenticate, (req, res) => {
    const listId = Number(req.params.id);
    const itemId = Number(req.params.itemId);
    if (!hasListAccess(listId, req.userId!)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const stmt = db.prepare('DELETE FROM list_items WHERE id = ? AND list_id = ?');
    stmt.run([itemId, listId]);
    stmt.free();
    res.json({ ok: true });
  });

  app.patch('/api/lists/:id/items/:itemId', authenticate, (req, res) => {
    const listId = Number(req.params.id);
    const itemId = Number(req.params.itemId);
    if (!hasListAccess(listId, req.userId!)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { completed, starred } = req.body;
    const updates = [];
    const params = [];
    if (completed !== undefined) {
      updates.push('completed = ?');
      params.push(completed ? 1 : 0);
    }
    if (starred !== undefined) {
      updates.push('starred = ?');
      params.push(starred ? 1 : 0);
    }
    if (updates.length > 0) {
      params.push(itemId, listId);
      const stmt = db.prepare('UPDATE list_items SET ' + updates.join(', ') + ' WHERE id = ? AND list_id = ?');
      stmt.run(params);
      stmt.free();
    }
    res.json({ ok: true });
  });

  app.delete('/api/lists/:id', authenticate, (req, res) => {
    const listId = Number(req.params.id);
    const listStmt = db.prepare('SELECT owner_id FROM lists WHERE id = ?');
    const list: any = listStmt.get([listId]);
    listStmt.free();
    if (!list) return res.status(404).json({ error: 'List not found' });
    if (list.owner_id !== req.userId!) {
      return res.status(403).json({ error: 'Only owner can delete' });
    }
    const delItems = db.prepare('DELETE FROM list_items WHERE list_id = ?');
    delItems.run([listId]);
    delItems.free();
    const delMembers = db.prepare('DELETE FROM list_members WHERE list_id = ?');
    delMembers.run([listId]);
    delMembers.free();
    const delList = db.prepare('DELETE FROM lists WHERE id = ?');
    delList.run([listId]);
    delList.free();
    res.json({ ok: true });
  });

  // ---------- sharing ----------
  app.post('/api/lists/:id/invite', authenticate, (req, res) => {
    const listId = Number(req.params.id);
    if (!hasListAccess(listId, req.userId!)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }
    const userStmt = db.prepare('SELECT id FROM users WHERE username = ?');
    const userRow: any = userStmt.get([username]);
    userStmt.free();
    if (!userRow) {
      return res.status(404).json({ error: 'User not found' });
    }
    try {
      const memberStmt = db.prepare('INSERT INTO list_members (list_id, user_id, invited_by) VALUES (?, ?, ?)');
      memberStmt.run([listId, userRow[0], req.userId!]);
      memberStmt.free();
      res.json({ ok: true });
    } catch (e: any) {
      if (e.message && e.message.includes('UNIQUE')) {
        res.status(400).json({ error: 'User already has access' });
      } else {
        res.status(500).json({ error: 'Invite failed' });
      }
    }
  });

  app.get('/api/lists/:id/members', authenticate, (req, res) => {
    const listId = Number(req.params.id);
    if (!hasListAccess(listId, req.userId!)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const stmt = db.prepare('SELECT u.id, u.username, u.email, lm.created_at FROM list_members lm JOIN users u ON u.id = lm.user_id WHERE lm.list_id = ?');
    const rows: any[] = allRows(stmt, [listId]);
    stmt.free();
    res.json({ members: rows.map((r: any) => ({ id: r.id, username: r.username, email: r.email, created_at: r.created_at })) });
  });

  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error: ' + (err.message || 'unknown') });
  });

  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}

init().catch((err) => {
  console.error('Failed to initialize backend:', err);
  process.exit(1);
});
