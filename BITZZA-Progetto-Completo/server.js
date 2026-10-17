require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('node:crypto');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a value of at least 32 characters');
}

const app = express();
const PORT = Number(process.env.PORT || 3000);
if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
  throw new Error('PORT must be a valid TCP port number');
}

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database(process.env.DB_PATH || './bitzza.db');
db.configure('busyTimeout', 5000);
db.run('PRAGMA foreign_keys = ON');
let transactionQueue = Promise.resolve();
let transactionInProgress = false;
const waitingRequests = [];

app.use((req, res, next) => {
  if (transactionInProgress) waitingRequests.push(next);
  else next();
});

// ----- Schema -----
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    wallet_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    balance REAL DEFAULT 100,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    label TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_user_id) REFERENCES users(id),
    FOREIGN KEY (to_user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS payment_idempotency (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    idempotency_key TEXT NOT NULL,
    request_fingerprint TEXT NOT NULL,
    transaction_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, idempotency_key),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS token_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, symbol TEXT, decimals INTEGER DEFAULT 18,
    total_supply REAL DEFAULT 1000000, contract_address TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    price_usd REAL NOT NULL, market_cap REAL, volume_24h REAL,
    change_24h REAL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS address_book (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, label TEXT NOT NULL, address TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, address)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    theme TEXT DEFAULT 'light',
    notifications_enabled INTEGER DEFAULT 1,
    privacy_mode INTEGER DEFAULT 0,
    default_slippage REAL DEFAULT 0.5,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS mining_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, amount REAL NOT NULL DEFAULT 0.5,
    mined_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS commodity_holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, commodity TEXT NOT NULL,
    amount REAL DEFAULT 0, UNIQUE(user_id, commodity)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS commodity_purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, commodity TEXT NOT NULL,
    bitz_spent REAL NOT NULL, units_received REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS commodity_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, commodity TEXT NOT NULL,
    bitz_received REAL NOT NULL, units_sold REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS mining_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    total_claims INTEGER DEFAULT 0,
    total_mined REAL DEFAULT 0,
    current_difficulty REAL DEFAULT 1.0,
    last_claim_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  db.run(`UPDATE mining_state
    SET total_claims = (SELECT SUM(total_claims) FROM mining_state AS duplicate WHERE duplicate.user_id = mining_state.user_id),
        total_mined = (SELECT SUM(total_mined) FROM mining_state AS duplicate WHERE duplicate.user_id = mining_state.user_id),
        current_difficulty = (SELECT current_difficulty FROM mining_state AS duplicate
          WHERE duplicate.user_id = mining_state.user_id ORDER BY duplicate.last_claim_at DESC, duplicate.id DESC LIMIT 1),
        last_claim_at = (SELECT MAX(last_claim_at) FROM mining_state AS duplicate WHERE duplicate.user_id = mining_state.user_id)
    WHERE id IN (SELECT MIN(id) FROM mining_state GROUP BY user_id HAVING COUNT(*) > 1)`);
  db.run('DELETE FROM mining_state WHERE id NOT IN (SELECT MIN(id) FROM mining_state GROUP BY user_id)');
  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_mining_state_user ON mining_state(user_id)');
  db.run(`CREATE TABLE IF NOT EXISTS pizza_merchants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    balance REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS pizza_vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    merchant_id INTEGER NOT NULL,
    code TEXT NOT NULL UNIQUE,
    request_id TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed')),
    purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    redeemed_at DATETIME,
    redeemed_by INTEGER,
    UNIQUE(user_id, request_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (merchant_id) REFERENCES pizza_merchants(id),
    FOREIGN KEY (redeemed_by) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS pizza_merchant_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    merchant_id INTEGER NOT NULL,
    voucher_id INTEGER NOT NULL UNIQUE,
    amount REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES pizza_merchants(id),
    FOREIGN KEY (voucher_id) REFERENCES pizza_vouchers(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS pizza_treasury (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    balance REAL NOT NULL DEFAULT 0
  )`);
  db.run('INSERT OR IGNORE INTO pizza_treasury (id, balance) VALUES (1, 0)');
});

// ----- Auth middleware -----
function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Bearer access token required' });
  }
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ----- Helpers -----
function getUserByEmail(email, cb) {
  db.get('SELECT * FROM users WHERE email = ?', [email], cb);
}
function getWalletByUserId(uid, cb) {
  db.get('SELECT * FROM wallets WHERE user_id = ?', [uid], cb);
}
function runTransaction(work, callback) {
  const operation = transactionQueue.then(() => new Promise((resolve) => {
    transactionInProgress = true;
    db.run('BEGIN IMMEDIATE', (beginError) => {
      let finished = false;
      const complete = (error, result) => {
        if (finished) return;
        finished = true;
        transactionInProgress = false;
        waitingRequests.splice(0).forEach((next) => next());
        resolve();
        callback(error, result);
      };
      const finish = (error, result) => {
        if (error) {
          return db.run('ROLLBACK', (rollbackError) => complete(error || rollbackError));
        }
        db.run('COMMIT', (commitError) => {
          if (commitError) return db.run('ROLLBACK', () => complete(commitError));
          complete(null, result);
        });
      };
      if (beginError) return complete(beginError);
      try {
        work(finish);
      } catch (error) {
        finish(error);
      }
    });
  }));
  transactionQueue = operation.catch((error) => {
    console.error('Database transaction queue failed:', error.message);
  });
}

// ----- Routes -----
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), service: 'BITZZA Wallet Service' });
});

app.post('/api/register', async (req, res) => {
  const { email: submittedEmail, password } = req.body || {};
  const email = typeof submittedEmail === 'string' ? submittedEmail.trim().toLowerCase() : '';
  if (!email || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be between 8 and 128 characters' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const walletAddr = '0x' + crypto.randomBytes(20).toString('hex');
    runTransaction((finish) => {
      db.run('INSERT INTO users (email, password_hash, wallet_address) VALUES (?, ?, ?)',
        [email, hash, walletAddr], function(userError) {
          if (userError) return finish(userError);
          const uid = this.lastID;
          db.run('INSERT INTO wallets (user_id, balance) VALUES (?, 100)', [uid], (walletError) => {
            if (walletError) return finish(walletError);
            db.run('INSERT INTO user_settings (user_id) VALUES (?)', [uid], (settingsError) => {
              if (settingsError) return finish(settingsError);
              finish(null, uid);
            });
          });
        });
    }, (registrationError, uid) => {
      if (registrationError) {
        if (registrationError.code === 'SQLITE_CONSTRAINT') {
          return res.status(409).json({ error: 'An account with this email already exists' });
        }
        console.error('Registration failed:', registrationError.message);
        return res.status(500).json({ error: 'Registration failed' });
      }
      const token = jwt.sign({ userId: uid, email }, JWT_SECRET, { expiresIn: '7d' });
      res.status(201).json({ message: 'User registered successfully', token });
    });
  } catch (error) {
    console.error('Registration failed:', error.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email: submittedEmail, password } = req.body || {};
  const email = typeof submittedEmail === 'string' ? submittedEmail.trim().toLowerCase() : '';
  if (!email || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password required' });
  }
  getUserByEmail(email, async (err, user) => {
    if (err) return res.status(500).json({ error: 'Login failed' });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    try {
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
      const token = jwt.sign({ userId: user.id, email }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ message: 'Login successful', token });
    } catch (error) {
      console.error('Login failed:', error.message);
      res.status(500).json({ error: 'Login failed' });
    }
  });
});

app.get('/api/profile', auth, (req, res) => {
  db.get('SELECT id, email, wallet_address, created_at FROM users WHERE id = ?',
    [req.user.userId], (err, user) => {
      if (err || !user) return res.status(404).json({ error: 'User not found' });
      db.get('SELECT * FROM user_settings WHERE user_id = ?', [user.id], (e, settings) => {
        res.json({ ...user, settings: settings || {} });
      });
    });
});

app.get('/api/balance', auth, (req, res) => {
  getWalletByUserId(req.user.userId, (err, w) => {
    if (err || !w) return res.status(404).json({ error: 'Wallet not found' });
    res.json({ userId: req.user.userId, balance: w.balance, currency: 'BITZ' });
  });
});

app.post('/api/send', auth, (req, res) => {
  const { amount, recipientEmail, description, label } = req.body || {};
  const senderId = req.user.userId;
  if (amount === undefined || !recipientEmail) return res.status(400).json({ error: 'Amount and recipient required' });
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0 || Math.round(amt * 100) !== amt * 100) {
    return res.status(400).json({ error: 'Amount must be a positive value with at most two decimal places' });
  }
  const normalizedRecipientEmail = typeof recipientEmail === 'string' ? recipientEmail.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedRecipientEmail)) {
    return res.status(400).json({ error: 'Invalid recipient email format' });
  }
  if (description !== undefined && (typeof description !== 'string' || description.length > 200)) {
    return res.status(400).json({ error: 'Description must be 200 characters or fewer' });
  }
  if (label !== undefined && label !== null && (typeof label !== 'string' || label.length > 80)) {
    return res.status(400).json({ error: 'Label must be 80 characters or fewer' });
  }
  const idempotencyKey = req.get('Idempotency-Key');
  if (idempotencyKey && !/^[A-Za-z0-9_-]{16,80}$/.test(idempotencyKey)) {
    return res.status(400).json({ error: 'Invalid idempotency key' });
  }
  const requestFingerprint = crypto.createHash('sha256')
    .update(JSON.stringify({
      recipient: normalizedRecipientEmail,
      amount: amt,
      description: description || 'Payment',
      label: label || null,
    }))
    .digest('hex');

  getUserByEmail(normalizedRecipientEmail, (err, recipient) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
    if (recipient.id === senderId) return res.status(400).json({ error: 'Cannot send to yourself' });

    getWalletByUserId(senderId, (e1, sw) => {
      if (e1 || !sw) return res.status(404).json({ error: 'Sender wallet not found' });
      getWalletByUserId(recipient.id, (e2, rw) => {
        if (e2 || !rw) return res.status(404).json({ error: 'Recipient wallet not found' });

        runTransaction((finish) => {
          const sendPayment = () => {
            db.run('UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND balance >= ?',
              [amt, senderId, amt], function(deductionError) {
                if (deductionError) return finish(deductionError);
                if (this.changes !== 1) return finish(new Error('INSUFFICIENT_BALANCE'));
                db.run('UPDATE wallets SET balance = balance + ? WHERE user_id = ?',
                    [amt, recipient.id], function(creditError) {
                      if (creditError) return finish(creditError);
                      if (this.changes !== 1) return finish(new Error('RECIPIENT_WALLET_NOT_FOUND'));
                      db.run('INSERT INTO transactions (from_user_id, to_user_id, amount, description, label) VALUES (?, ?, ?, ?, ?)',
                        [senderId, recipient.id, amt, description || 'Payment', label || null], function(transactionError) {
                          if (transactionError) return finish(transactionError);
                          const transactionId = this.lastID;
                          if (!idempotencyKey) return finish(null, { transactionId, replayed: false });
                          db.run(`INSERT INTO payment_idempotency
                            (user_id, idempotency_key, request_fingerprint, transaction_id)
                            VALUES (?, ?, ?, ?)`,
                            [senderId, idempotencyKey, requestFingerprint, transactionId],
                            (idempotencyError) => {
                              if (idempotencyError) return finish(idempotencyError);
                              finish(null, { transactionId, replayed: false });
                            });
                        });
                    });
              });
          };
          if (!idempotencyKey) return sendPayment();
          db.get(`SELECT request_fingerprint, transaction_id FROM payment_idempotency
            WHERE user_id = ? AND idempotency_key = ?`, [senderId, idempotencyKey], (readError, existing) => {
            if (readError) return finish(readError);
            if (!existing) return sendPayment();
            if (existing.request_fingerprint !== requestFingerprint) {
              return finish(new Error('IDEMPOTENCY_KEY_REUSED'));
            }
            finish(null, { transactionId: existing.transaction_id, replayed: true });
          });
        }, (paymentError, result) => {
          if (paymentError?.message === 'INSUFFICIENT_BALANCE') {
            return res.status(400).json({ error: 'Insufficient balance' });
          }
          if (paymentError?.message === 'RECIPIENT_WALLET_NOT_FOUND') {
            return res.status(404).json({ error: 'Recipient wallet not found' });
          }
          if (paymentError) {
            if (paymentError.message === 'IDEMPOTENCY_KEY_REUSED') {
              return res.status(409).json({ error: 'Idempotency key was already used for a different payment' });
            }
            console.error('Payment failed:', paymentError.message);
            return res.status(500).json({ error: 'Payment failed' });
          }
          res.json({
            message: result.replayed ? 'Payment was already processed' : 'Payment sent successfully',
            transactionId: result.transactionId,
            replayed: result.replayed,
          });
        });
      });
    });
  });
});

app.get('/api/transactions', auth, (req, res) => {
  const uid = req.user.userId;
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
  const offset = Math.max(0, Number.parseInt(req.query.offset, 10) || 0);
  const type = req.query.type;
  const search = req.query.search;

  let q = `SELECT t.id, t.amount, t.description, t.label, t.created_at,
    CASE WHEN t.from_user_id = ? THEN 'sent' ELSE 'received' END as type,
    CASE WHEN t.from_user_id = ? THEN u2.email ELSE u1.email END as other_party
    FROM transactions t
    JOIN users u1 ON t.from_user_id = u1.id
    JOIN users u2 ON t.to_user_id = u2.id
    WHERE (t.from_user_id = ? OR t.to_user_id = ?)`;
  const p = [uid, uid, uid, uid];

  if (type === 'sent') { q += ' AND t.from_user_id = ?'; p.push(uid); }
  else if (type === 'received') { q += ' AND t.to_user_id = ?'; p.push(uid); }
  if (search) { q += ' AND (t.description LIKE ? OR t.label LIKE ?)'; const s = '%' + search + '%'; p.push(s, s); }
  q += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
  p.push(limit, offset);

  db.all(q, p, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error', details: err.message });
    let countQuery = 'SELECT COUNT(*) as total FROM transactions WHERE (from_user_id = ? OR to_user_id = ?)';
    const countParams = [uid, uid];
    if (type === 'sent') { countQuery += ' AND from_user_id = ?'; countParams.push(uid); }
    else if (type === 'received') { countQuery += ' AND to_user_id = ?'; countParams.push(uid); }
    if (search) {
      countQuery += ' AND (description LIKE ? OR label LIKE ?)';
      const pattern = '%' + search + '%';
      countParams.push(pattern, pattern);
    }
    db.get(countQuery, countParams, (e, c) => {
        if (e) return res.status(500).json({ error: 'Database error' });
        res.json({
          transactions: (rows || []).map(r => ({
            id: r.id, amount: r.amount, type: r.type,
            description: r.description, label: r.label,
            createdAt: r.created_at, otherParty: r.other_party
          })),
          pagination: { total: c ? c.total : 0, limit, offset }
        });
      });
  });
});

// Address book
app.get('/api/address-book', auth, (req, res) => {
  db.all('SELECT * FROM address_book WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.userId], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ contacts: rows || [] });
    });
});

app.post('/api/address-book', auth, (req, res) => {
  const label = typeof req.body?.label === 'string' ? req.body.label.trim() : '';
  const address = typeof req.body?.address === 'string' ? req.body.address.trim().toLowerCase() : '';
  if (!label || !address) return res.status(400).json({ error: 'Label and address required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return res.status(400).json({ error: 'Invalid email format' });
  db.run(`INSERT INTO address_book (user_id, label, address) VALUES (?, ?, ?)
    ON CONFLICT(user_id, address) DO UPDATE SET label = excluded.label`,
    [req.user.userId, label, address], function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ message: 'Contact saved successfully', id: this.lastID });
    });
});

app.delete('/api/address-book/:id', auth, (req, res) => {
  db.run('DELETE FROM address_book WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.userId], function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ error: 'Contact not found' });
      res.json({ message: 'Contact deleted successfully' });
    });
});

// Wallet export (FIXED: split queries)
app.get('/api/wallet/export', auth, (req, res) => {
  const uid = req.user.userId;
  db.get('SELECT email FROM users WHERE id = ?', [uid], (e1, u) => {
    if (e1 || !u) return res.status(404).json({ error: 'User not found' });
    db.get('SELECT balance FROM wallets WHERE user_id = ?', [uid], (e2, w) => {
      if (e2) return res.status(500).json({ error: 'Database error' });
      db.all(`SELECT t.id, t.amount, t.description, t.label, t.created_at,
        CASE WHEN t.from_user_id = ? THEN 'sent' ELSE 'received' END as type,
        CASE WHEN t.from_user_id = ? THEN u2.email ELSE u1.email END as other_party
        FROM transactions t
        JOIN users u1 ON t.from_user_id = u1.id
        JOIN users u2 ON t.to_user_id = u2.id
        WHERE t.from_user_id = ? OR t.to_user_id = ?
        ORDER BY t.created_at DESC`,
        [uid, uid, uid, uid], (e3, rows) => {
          if (e3) return res.status(500).json({ error: 'Database error', details: e3.message });
          res.json({
            version: '1.0',
            exportedAt: new Date().toISOString(),
            user: { email: u.email, balance: w ? w.balance : 0 },
            transactions: (rows || []).map(r => ({
              id: r.id, amount: r.amount, type: r.type,
              description: r.description || '', label: r.label || '',
              createdAt: r.created_at, otherParty: r.other_party
            }))
          });
        });
    });
  });
});

// User settings
app.get('/api/user/settings', auth, (req, res) => {
  db.get('SELECT * FROM user_settings WHERE user_id = ?', [req.user.userId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) {
      return db.run('INSERT INTO user_settings (user_id) VALUES (?)', [req.user.userId], (insertError) => {
        if (insertError) return res.status(500).json({ error: 'Could not initialize settings' });
        db.get('SELECT * FROM user_settings WHERE user_id = ?', [req.user.userId], (readError, settings) => {
          if (readError) return res.status(500).json({ error: 'Could not load settings' });
          res.json(settings);
        });
      });
    }
    res.json(row);
  });
});

app.put('/api/user/settings', auth, (req, res) => {
  const { theme, notifications_enabled, privacy_mode, default_slippage } = req.body || {};
  if (theme !== undefined && !['light', 'dark', 'system'].includes(theme)) {
    return res.status(400).json({ error: 'Theme must be light, dark, or system' });
  }
  if (notifications_enabled !== undefined && ![0, 1, false, true].includes(notifications_enabled)) {
    return res.status(400).json({ error: 'notifications_enabled must be a boolean' });
  }
  if (privacy_mode !== undefined && ![0, 1, false, true].includes(privacy_mode)) {
    return res.status(400).json({ error: 'privacy_mode must be a boolean' });
  }
  if (default_slippage !== undefined &&
      (!Number.isFinite(Number(default_slippage)) || Number(default_slippage) < 0 || Number(default_slippage) > 50)) {
    return res.status(400).json({ error: 'default_slippage must be between 0 and 50' });
  }
  db.run('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)', [req.user.userId], (insertError) => {
    if (insertError) return res.status(500).json({ error: 'Database error' });
    db.run(`UPDATE user_settings SET
      theme = COALESCE(?, theme),
      notifications_enabled = COALESCE(?, notifications_enabled),
      privacy_mode = COALESCE(?, privacy_mode),
      default_slippage = COALESCE(?, default_slippage),
      updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?`,
      [theme ?? null, notifications_enabled === undefined ? null : Number(Boolean(notifications_enabled)),
        privacy_mode === undefined ? null : Number(Boolean(privacy_mode)),
        default_slippage ?? null, req.user.userId],
      function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        db.get('SELECT * FROM user_settings WHERE user_id = ?', [req.user.userId], (readError, settings) => {
          if (readError) return res.status(500).json({ error: 'Could not load updated settings' });
          res.json(settings);
        });
      });
  });
});

// Token info
app.get('/api/token/info', (req, res) => {
  db.get('SELECT * FROM token_metadata ORDER BY id DESC LIMIT 1', [], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) {
      const addr = '0x000000000000000000000000000000000000b17a';
      db.run('INSERT INTO token_metadata (name, symbol, total_supply, contract_address) VALUES (?, ?, ?, ?)',
        ['BITZZA', 'BITZ', 1000000, addr], (insertError) => {
          if (insertError) return res.status(500).json({ error: 'Could not initialize token metadata' });
          res.json({
            name: 'BITZZA', symbol: 'BITZ', decimals: 18,
            total_supply: 1000000, contract_address: addr,
          });
        });
      return;
    }
    res.json(row);
  });
});

// Market data
app.get('/api/market/data', (req, res) => {
  db.get('SELECT * FROM price_history ORDER BY timestamp DESC, id DESC LIMIT 1', [], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) {
      const p = 12.5, mc = 12500000, v = 250000, c = 5.2;
      db.run('INSERT INTO price_history (price_usd, market_cap, volume_24h, change_24h) VALUES (?, ?, ?, ?)',
        [p, mc, v, c], (insertError) => {
          if (insertError) return res.status(500).json({ error: 'Could not initialize market data' });
          db.get('SELECT * FROM price_history ORDER BY timestamp DESC, id DESC LIMIT 1', [], (readError, seeded) => {
            if (readError) return res.status(500).json({ error: 'Could not load market data' });
            res.json(seeded);
          });
        });
      return;
    }
    res.json(row);
  });
});

app.get('/api/market/history', (req, res) => {
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 30));
  db.all('SELECT * FROM price_history ORDER BY timestamp DESC, id DESC LIMIT ?', [limit], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ history: (rows || []).reverse() });
  });
});

// Mining
app.post('/api/mining/claim', auth, (req, res) => {
  const uid = req.user.userId;

  // Get or create mining state for user
  db.get('SELECT * FROM mining_state WHERE user_id = ?', [uid], (err, state) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    // Initialize state if not exists
    if (!state) {
      db.run('INSERT OR IGNORE INTO mining_state (user_id) VALUES (?)', [uid], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to initialize mining state' });
        // Retry the query to get the newly created state
        return db.get('SELECT * FROM mining_state WHERE user_id = ?', [uid], (err, state) => {
          if (err) return res.status(500).json({ error: 'Database error' });
          processClaim(state);
        });
      });
    } else {
      processClaim(state);
    }
  });

  function processClaim(state) {
    // Check cooldown from last claim
    let secs = 0;
    if (state.last_claim_at) {
      const el = Math.floor((Date.now() - new Date(`${state.last_claim_at}Z`).getTime()) / 1000);
      const cooldown = 60 * state.current_difficulty;
      secs = Math.max(0, cooldown - el);
    }

    if (secs > 0) {
      return res.status(429).json({
        error: 'Cooldown attivo',
        secondsRemaining: secs
      });
    }

    // Calculate reward based on difficulty
    const reward = 0.5 / state.current_difficulty;
    const cooldown = Math.ceil(60 * state.current_difficulty);
    const nextDifficulty = Math.min(state.current_difficulty * 1.15, 10.0);

    runTransaction((finish) => {
      db.run('UPDATE mining_state SET ' +
        'total_claims = total_claims + 1, ' +
        'total_mined = total_mined + ?, ' +
        'current_difficulty = ?, ' +
        'last_claim_at = strftime("%Y-%m-%d %H:%M:%S", "now") ' +
        'WHERE user_id = ? AND current_difficulty = ? AND ' +
        '(last_claim_at IS NULL OR datetime(last_claim_at, "+" || ? || " seconds") <= CURRENT_TIMESTAMP)',
        [reward, nextDifficulty, uid, state.current_difficulty, cooldown], function(err) {
          if (err) return finish(err);
          if (this.changes !== 1) return finish(new Error('MINING_COOLDOWN'));
          db.run('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', [reward, uid], function(walletError) {
            if (walletError) return finish(walletError);
            if (this.changes !== 1) return finish(new Error('WALLET_NOT_FOUND'));
            db.run('INSERT INTO mining_rewards (user_id, amount) VALUES (?, ?)', [uid, reward], (rewardError) => {
              if (rewardError) return finish(rewardError);
              db.get('SELECT balance FROM wallets WHERE user_id = ?', [uid], (balanceError, wallet) => {
                if (balanceError || !wallet) return finish(balanceError || new Error('Wallet not found'));
                finish(null, {
                  balance: wallet.balance,
                  totalClaims: state.total_claims + 1,
                  totalMined: state.total_mined + reward,
                });
              });
            });
          });
        });
    }, (claimError, result) => {
      if (claimError?.message === 'MINING_COOLDOWN') {
        return db.get('SELECT last_claim_at, current_difficulty FROM mining_state WHERE user_id = ?', [uid], (readError, current) => {
          if (readError || !current) return res.status(500).json({ error: 'Could not verify mining cooldown' });
          const elapsed = current.last_claim_at
            ? Math.floor((Date.now() - new Date(`${current.last_claim_at}Z`).getTime()) / 1000)
            : 0;
          const remaining = Math.max(0, Math.ceil(current.current_difficulty * 60) - elapsed);
          res.status(429).json({ error: 'Cooldown attivo', secondsRemaining: remaining });
        });
      }
      if (claimError?.message === 'WALLET_NOT_FOUND') {
        return res.status(404).json({ error: 'Wallet not found' });
      }
      if (claimError) {
        console.error('Mining reward failed:', claimError.message);
        return res.status(500).json({ error: 'Mining reward failed' });
      }
      res.json({
        success: true,
        amount: reward,
        newBalance: result.balance,
        nextClaimAt: new Date(Date.now() + cooldown * 1000).toISOString(),
        currentDifficulty: nextDifficulty,
        totalClaims: result.totalClaims,
        totalMined: result.totalMined,
      });
    });
  }
});

app.get('/api/mining/status', auth, (req, res) => {
  const uid = req.user.userId;
  db.run('INSERT OR IGNORE INTO mining_state (user_id) VALUES (?)', [uid], (insertError) => {
    if (insertError) return res.status(500).json({ error: 'Failed to initialize mining state' });
    db.get('SELECT * FROM mining_state WHERE user_id = ?', [uid], (err, state) => {
      if (err || !state) return res.status(500).json({ error: 'Could not read mining state' });

      const elapsedSeconds = state.last_claim_at
        ? Math.floor((Date.now() - new Date(`${state.last_claim_at}Z`).getTime()) / 1000)
        : 0;
      const cooldownSeconds = state.last_claim_at ? Math.ceil(60 * state.current_difficulty) : 0;
      const secondsRemaining = Math.max(0, cooldownSeconds - elapsedSeconds);

      res.json({
        canClaim: secondsRemaining === 0,
        secondsRemaining,
        totalMined: state.total_mined,
        totalClaims: state.total_claims,
        currentDifficulty: state.current_difficulty,
        nextReward: 0.5 / state.current_difficulty,
      });
    });
  });
});

// Commodities
const COMMODITY_PRICES = { Pomodoro: 2, Grano: 1, Latte: 1.5 };

app.get('/api/commodities', auth, (req, res) => {
  db.all('SELECT commodity, amount FROM commodity_holdings WHERE user_id = ?', [req.user.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    const h = {};
    (rows || []).forEach(r => { h[r.commodity] = r.amount; });
    ['Pomodoro', 'Grano', 'Latte'].forEach(c => { if (!(c in h)) h[c] = 0; });
    res.json({ holdings: h });
  });
});

app.post('/api/commodities/buy', auth, (req, res) => {
  const uid = req.user.userId;
  const { commodity, units } = req.body || {};
  if (!commodity || units === undefined) return res.status(400).json({ error: 'Commodity and units required' });
  if (!COMMODITY_PRICES[commodity]) return res.status(400).json({ error: 'Invalid commodity' });
  const u = Number(units);
  if (!Number.isFinite(u) || u <= 0 || Math.round(u * 100) !== u * 100) {
    return res.status(400).json({ error: 'Units must be positive with at most two decimal places' });
  }
  const cost = Math.round(u * COMMODITY_PRICES[commodity] * 100) / 100;

  runTransaction((finish) => {
    db.run('UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND balance >= ?',
      [cost, uid, cost], function(walletError) {
        if (walletError) return finish(walletError);
        if (this.changes !== 1) return finish(new Error('INSUFFICIENT_BALANCE'));
        db.run(`INSERT INTO commodity_holdings (user_id, commodity, amount) VALUES (?, ?, ?)
          ON CONFLICT(user_id, commodity) DO UPDATE SET amount = amount + excluded.amount`,
          [uid, commodity, u], (holdingError) => {
            if (holdingError) return finish(holdingError);
            db.run('INSERT INTO commodity_purchases (user_id, commodity, bitz_spent, units_received) VALUES (?, ?, ?, ?)',
              [uid, commodity, cost, u], (purchaseError) => {
                if (purchaseError) return finish(purchaseError);
                db.get('SELECT balance FROM wallets WHERE user_id = ?', [uid], (balanceError, wallet) => {
                  if (balanceError || !wallet) return finish(balanceError || new Error('Wallet not found'));
                  db.get('SELECT amount FROM commodity_holdings WHERE user_id = ? AND commodity = ?',
                    [uid, commodity], (readError, holding) => {
                      if (readError || !holding) return finish(readError || new Error('Holding not found'));
                      finish(null, { newBalance: wallet.balance, newHolding: holding.amount });
                    });
                });
              });
          });
      });
  }, (error, result) => {
    if (error?.message === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    if (error) {
      console.error('Commodity purchase failed:', error.message);
      return res.status(500).json({ error: 'Commodity purchase failed' });
    }
    res.json({ success: true, ...result });
  });
});

app.post('/api/commodities/sell', auth, (req, res) => {
  const uid = req.user.userId;
  const { commodity, units } = req.body || {};
  if (!commodity || units === undefined) return res.status(400).json({ error: 'Commodity and units required' });
  if (!COMMODITY_PRICES[commodity]) return res.status(400).json({ error: 'Invalid commodity' });
  const u = Number(units);
  if (!Number.isFinite(u) || u <= 0 || Math.round(u * 100) !== u * 100) {
    return res.status(400).json({ error: 'Units must be positive with at most two decimal places' });
  }

  const bitz = Math.round(u * COMMODITY_PRICES[commodity] * 0.95 * 100) / 100;
  runTransaction((finish) => {
    db.run('UPDATE commodity_holdings SET amount = amount - ? WHERE user_id = ? AND commodity = ? AND amount >= ?',
      [u, uid, commodity, u], function(holdingError) {
        if (holdingError) return finish(holdingError);
        if (this.changes !== 1) return finish(new Error('INSUFFICIENT_HOLDINGS'));
        db.run('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', [bitz, uid], (walletError) => {
          if (walletError) return finish(walletError);
          db.run('INSERT INTO commodity_sales (user_id, commodity, bitz_received, units_sold) VALUES (?, ?, ?, ?)',
            [uid, commodity, bitz, u], (saleError) => {
              if (saleError) return finish(saleError);
              db.get('SELECT balance FROM wallets WHERE user_id = ?', [uid], (balanceError, wallet) => {
                if (balanceError || !wallet) return finish(balanceError || new Error('Wallet not found'));
                db.get('SELECT amount FROM commodity_holdings WHERE user_id = ? AND commodity = ?',
                  [uid, commodity], (readError, holding) => {
                    if (readError || !holding) return finish(readError || new Error('Holding not found'));
                    finish(null, { newBalance: wallet.balance, newHolding: holding.amount });
                  });
              });
            });
        });
      });
  }, (error, result) => {
    if (error?.message === 'INSUFFICIENT_HOLDINGS') {
      return res.status(400).json({ error: 'Insufficient holdings' });
    }
    if (error) {
      console.error('Commodity sale failed:', error.message);
      return res.status(500).json({ error: 'Commodity sale failed' });
    }
    res.json({ success: true, ...result, bitzReceived: bitz });
  });
});

// Pizza voucher and demo pizzeria POS
const PIZZA_VOUCHER_PRICE = 12.5;

app.get('/api/pizza/menu', (req, res) => {
  res.json({
    currency: 'BITZ',
    demo: true,
    products: [{
      id: 'pizza-voucher',
      name: 'Voucher pizza',
      description: 'Prepagamento demo per una pizza presso la pizzeria selezionata.',
      price: PIZZA_VOUCHER_PRICE,
      ingredients: ['grano', 'pomodoro', 'latticini'],
      allergens: ['glutine', 'latte'],
      disclosure: 'Ingredienti e allergeni sono illustrativi: verificare sempre le informazioni presso il venditore.',
    }],
  });
});

app.get('/api/pizza/merchants', (req, res) => {
  db.all('SELECT id, name, location FROM pizza_merchants ORDER BY name COLLATE NOCASE',
    [], (err, merchants) => {
      if (err) return res.status(500).json({ error: 'Could not load pizzerias' });
      res.json({ merchants: merchants || [] });
    });
});

app.post('/api/pizza/merchant', auth, (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const location = typeof req.body?.location === 'string' ? req.body.location.trim() : '';
  if (!name || name.length > 100) {
    return res.status(400).json({ error: 'Pizzeria name is required and must be 100 characters or fewer' });
  }
  if (!location || location.length > 120) {
    return res.status(400).json({ error: 'Pizzeria location is required and must be 120 characters or fewer' });
  }
  db.run(`INSERT INTO pizza_merchants (user_id, name, location) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET name = excluded.name, location = excluded.location`,
    [req.user.userId, name, location], (err) => {
      if (err) return res.status(500).json({ error: 'Could not save pizzeria profile' });
      db.get(`SELECT id, name, location, balance, created_at
        FROM pizza_merchants WHERE user_id = ?`, [req.user.userId], (readError, merchant) => {
        if (readError || !merchant) return res.status(500).json({ error: 'Could not load pizzeria profile' });
        res.json({ merchant });
      });
    });
});

app.get('/api/pizza/merchant', auth, (req, res) => {
  db.get(`SELECT id, name, location, balance, created_at
    FROM pizza_merchants WHERE user_id = ?`, [req.user.userId], (err, merchant) => {
    if (err) return res.status(500).json({ error: 'Could not load pizzeria profile' });
    if (!merchant) return res.json({ merchant: null, sales: [] });
    db.all(`SELECT s.id, s.amount, s.created_at AS redeemedAt, v.code, v.purchased_at AS purchasedAt
      FROM pizza_merchant_sales s
      JOIN pizza_vouchers v ON v.id = s.voucher_id
      WHERE s.merchant_id = ?
      ORDER BY s.created_at DESC LIMIT 100`, [merchant.id], (salesError, sales) => {
      if (salesError) return res.status(500).json({ error: 'Could not load pizzeria sales' });
      res.json({ merchant, sales: sales || [] });
    });
  });
});

app.get('/api/pizza/vouchers', auth, (req, res) => {
  db.all(`SELECT v.id, v.code, v.amount, v.status, v.purchased_at AS purchasedAt,
      v.redeemed_at AS redeemedAt, m.name AS merchantName, m.location AS merchantLocation
    FROM pizza_vouchers v
    JOIN pizza_merchants m ON m.id = v.merchant_id
    WHERE v.user_id = ?
    ORDER BY v.purchased_at DESC`, [req.user.userId], (err, vouchers) => {
    if (err) return res.status(500).json({ error: 'Could not load pizza vouchers' });
    res.json({ vouchers: vouchers || [] });
  });
});

app.post('/api/pizza/vouchers', auth, (req, res) => {
  const merchantId = Number(req.body?.merchantId);
  const requestId = req.body?.requestId;
  if (!Number.isInteger(merchantId) || merchantId <= 0) {
    return res.status(400).json({ error: 'Select a valid pizzeria' });
  }
  if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{16,80}$/.test(requestId)) {
    return res.status(400).json({ error: 'A valid request id is required' });
  }

  const userId = req.user.userId;
  const code = `BZ-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  runTransaction((finish) => {
    db.get('SELECT id FROM pizza_merchants WHERE id = ?', [merchantId], (merchantError, merchant) => {
      if (merchantError || !merchant) return finish(merchantError || new Error('PIZZERIA_NOT_FOUND'));
      db.get('SELECT id, code, amount, merchant_id FROM pizza_vouchers WHERE user_id = ? AND request_id = ?',
        [userId, requestId], (voucherError, existing) => {
          if (voucherError) return finish(voucherError);
          if (existing) {
            if (existing.merchant_id !== merchantId || existing.amount !== PIZZA_VOUCHER_PRICE) {
              return finish(new Error('VOUCHER_REQUEST_REUSED'));
            }
            return finish(null, { id: existing.id, code: existing.code, amount: existing.amount, replayed: true });
          }
          db.run('UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND balance >= ?',
            [PIZZA_VOUCHER_PRICE, userId, PIZZA_VOUCHER_PRICE], function(walletError) {
              if (walletError) return finish(walletError);
              if (this.changes !== 1) return finish(new Error('INSUFFICIENT_BALANCE'));
              db.run('UPDATE pizza_treasury SET balance = balance + ? WHERE id = 1',
                [PIZZA_VOUCHER_PRICE], (treasuryError) => {
                  if (treasuryError) return finish(treasuryError);
                  db.run(`INSERT INTO pizza_vouchers (user_id, merchant_id, code, request_id, amount)
                    VALUES (?, ?, ?, ?, ?)`, [userId, merchantId, code, requestId, PIZZA_VOUCHER_PRICE],
                    function(insertError) {
                      if (insertError) return finish(insertError);
                      finish(null, { id: this.lastID, code, amount: PIZZA_VOUCHER_PRICE, replayed: false });
                    });
                });
            });
        });
    });
  }, (purchaseError, voucher) => {
    if (purchaseError?.message === 'PIZZERIA_NOT_FOUND') {
      return res.status(404).json({ error: 'Pizzeria not found' });
    }
    if (purchaseError?.message === 'VOUCHER_REQUEST_REUSED') {
      return res.status(409).json({ error: 'Request id was already used for another voucher purchase' });
    }
    if (purchaseError?.message === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    if (purchaseError) {
      console.error('Pizza voucher purchase failed:', purchaseError.message);
      return res.status(500).json({ error: 'Could not purchase voucher' });
    }
    res.status(voucher.replayed ? 200 : 201).json({ success: true, voucher });
  });
});

app.post('/api/pizza/pos/redeem', auth, (req, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
  if (!/^BZ-[A-F0-9]{16}$/.test(code)) {
    return res.status(400).json({ error: 'Enter a valid voucher code' });
  }
  const merchantUserId = req.user.userId;
  runTransaction((finish) => {
    db.get('SELECT id FROM pizza_merchants WHERE user_id = ?', [merchantUserId], (merchantError, merchant) => {
      if (merchantError) return finish(merchantError);
      if (!merchant) return finish(new Error('MERCHANT_PROFILE_REQUIRED'));
      db.get('SELECT id, merchant_id, amount, status FROM pizza_vouchers WHERE code = ?', [code],
        (voucherError, voucher) => {
          if (voucherError) return finish(voucherError);
          if (!voucher) return finish(new Error('VOUCHER_NOT_FOUND'));
          if (voucher.merchant_id !== merchant.id) return finish(new Error('WRONG_PIZZERIA'));
          if (voucher.status !== 'active') return finish(new Error('VOUCHER_ALREADY_REDEEMED'));
          db.run(`UPDATE pizza_vouchers SET status = 'redeemed', redeemed_at = CURRENT_TIMESTAMP, redeemed_by = ?
            WHERE id = ? AND status = 'active'`, [merchantUserId, voucher.id], function(updateError) {
            if (updateError) return finish(updateError);
            if (this.changes !== 1) return finish(new Error('VOUCHER_ALREADY_REDEEMED'));
            db.run('UPDATE pizza_treasury SET balance = balance - ? WHERE id = 1 AND balance >= ?',
              [voucher.amount, voucher.amount], function(treasuryError) {
                if (treasuryError) return finish(treasuryError);
                if (this.changes !== 1) return finish(new Error('TREASURY_BALANCE_LOW'));
                db.run('UPDATE pizza_merchants SET balance = balance + ? WHERE id = ?',
                  [voucher.amount, merchant.id], (balanceError) => {
                    if (balanceError) return finish(balanceError);
                    db.run('INSERT INTO pizza_merchant_sales (merchant_id, voucher_id, amount) VALUES (?, ?, ?)',
                      [merchant.id, voucher.id, voucher.amount], (saleError) => {
                        if (saleError) return finish(saleError);
                        finish(null, { amount: voucher.amount, code, merchantId: merchant.id });
                      });
                  });
              });
          });
        });
    });
  }, (redeemError, sale) => {
    const statusErrors = {
      MERCHANT_PROFILE_REQUIRED: [403, 'Set up a pizzeria POS account before redeeming vouchers'],
      VOUCHER_NOT_FOUND: [404, 'Voucher not found'],
      WRONG_PIZZERIA: [400, 'This voucher was purchased for a different pizzeria'],
      VOUCHER_ALREADY_REDEEMED: [409, 'Voucher has already been redeemed'],
      TREASURY_BALANCE_LOW: [500, 'Pizzeria settlement is unavailable'],
    };
    if (statusErrors[redeemError?.message]) {
      const [status, message] = statusErrors[redeemError.message];
      return res.status(status).json({ error: message });
    }
    if (redeemError) {
      console.error('Pizza voucher redemption failed:', redeemError.message);
      return res.status(500).json({ error: 'Could not redeem voucher' });
    }
    res.json({ success: true, sale });
  });
});

// Pizza target
app.get('/api/pizza/target', (req, res) => {
  const TARGET = 12.5;
  db.get('SELECT price_usd FROM price_history ORDER BY timestamp DESC LIMIT 1', [], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    const cur = row ? row.price_usd : 12.5;
    const pct = Math.min(100, (cur / TARGET) * 100);
    const reached = cur >= TARGET;
    res.json({
      target_usd: TARGET, current_usd: cur,
      percentage: parseFloat(pct.toFixed(2)), reached,
      message: reached ? '🎉 Traguardo raggiunto!' : 'Mancano $ ' + (TARGET - cur).toFixed(2)
    });
  });
});

// Price simulation every 30s
const priceSimulationTimer = setInterval(() => {
  db.get('SELECT * FROM price_history ORDER BY timestamp DESC LIMIT 1', [], (err, row) => {
    if (err) {
      console.error('Price simulation could not read latest price:', err.message);
      return;
    }
    if (!row) return;
    const delta = (Math.random() - 0.5) * 0.04;
    const p = Math.max(5, row.price_usd * (1 + delta));
    const c = delta * 100, mc = p * 1000000, v = mc * (0.1 + Math.random() * 0.2);
    db.run('INSERT INTO price_history (price_usd, market_cap, volume_24h, change_24h) VALUES (?, ?, ?, ?)',
      [p, mc, v, c], (insertError) => {
        if (insertError) {
          console.error('Price simulation could not save market data:', insertError.message);
          return;
        }
        db.run(`DELETE FROM price_history WHERE id NOT IN (
          SELECT id FROM price_history ORDER BY timestamp DESC, id DESC LIMIT 1000
        )`, (cleanupError) => {
          if (cleanupError) console.error('Price history cleanup failed:', cleanupError.message);
        });
      });
  });
}, 30000);
priceSimulationTimer.unref();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('BITZZA Wallet Service running on port ' + PORT);
    console.log('Health: http://localhost:' + PORT + '/health');
    console.log('API base: http://localhost:' + PORT + '/api');
  });
}

module.exports = { app, db };
