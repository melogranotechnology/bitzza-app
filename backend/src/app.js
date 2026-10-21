const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ledger = require('./ledger');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function createApp(pool, config) {
  const { jwtSecret, corsOrigins = [], welcomeBonusMinor = 0, rateLimit = true } = config;
  if (!jwtSecret || jwtSecret.length < 32) throw new Error('JWT_SECRET deve avere almeno 32 caratteri');

  const app = express();
  app.set('trust proxy', 1);
  app.use(cors(corsOrigins.length ? { origin: corsOrigins } : undefined));
  app.use(express.json({ limit: '50kb' }));

  const attempts = new Map();
  function authLimit(req, res, next) {
    if (!rateLimit) return next();
    const now = Date.now();
    const entry = attempts.get(req.ip);
    if (!entry || now - entry.start > 15 * 60 * 1000) {
      attempts.set(req.ip, { start: now, count: 1 });
      return next();
    }
    entry.count += 1;
    if (entry.count > 20) return res.status(429).json({ error: 'Troppi tentativi, riprova più tardi' });
    return next();
  }

  const sign = (user) => jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: '7d' });

  async function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Autenticazione richiesta' });
    try {
      const { sub } = jwt.verify(token, jwtSecret);
      const { rows } = await pool.query(
        `SELECT u.id, u.email, u.display_name, a.id AS account_id
           FROM users u JOIN accounts a ON a.user_id = u.id WHERE u.id = $1`,
        [sub]
      );
      if (!rows.length) return res.status(401).json({ error: 'Utente non valido' });
      req.user = { id: rows[0].id, email: rows[0].email, displayName: rows[0].display_name, accountId: rows[0].account_id };
      return next();
    } catch {
      return res.status(401).json({ error: 'Token non valido' });
    }
  }

  const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

  app.get('/health', (req, res) => res.json({ status: 'OK', service: 'bitzza-backend' }));

  app.post('/api/register', authLimit, wrap(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const displayName = String(req.body?.displayName || '').trim().slice(0, 60);
    if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: 'Email non valida' });
    if (password.length < 10 || password.length > 128) return res.status(400).json({ error: 'La password deve avere da 10 a 128 caratteri' });
    if (!displayName) return res.status(400).json({ error: 'Nome obbligatorio' });

    const hash = await bcrypt.hash(password, 11);
    const client = await pool.connect();
    let user;
    try {
      await client.query('BEGIN');
      const u = await client.query(
        'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name',
        [email, hash, displayName]
      );
      user = u.rows[0];
      const a = await client.query('INSERT INTO accounts (user_id) VALUES ($1) RETURNING id', [user.id]);
      user.accountId = a.rows[0].id;
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      if (err.code === '23505') return res.status(409).json({ error: 'Email già registrata' });
      throw err;
    } finally {
      client.release();
    }

    if (welcomeBonusMinor > 0) {
      const treasury = await pool.query("SELECT id FROM accounts WHERE system_code = 'treasury'");
      await ledger.transfer(pool, {
        fromAccountId: treasury.rows[0].id,
        toAccountId: user.accountId,
        amountMinor: welcomeBonusMinor,
        kind: 'welcome_bonus',
        memo: 'Bonus di benvenuto',
        initiatedBy: user.id,
        idempotencyKey: 'welcome-bonus',
      });
    }
    return res.status(201).json({ token: sign(user), user: { email: user.email, displayName: user.display_name } });
  }));

  app.post('/api/login', authLimit, wrap(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const { rows } = await pool.query('SELECT id, email, display_name, password_hash FROM users WHERE email = $1', [email]);
    // Si confronta sempre un hash per non rivelare se l'email esiste.
    const hash = rows[0]?.password_hash || '$2a$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const ok = await bcrypt.compare(password, hash);
    if (!rows.length || !ok) return res.status(401).json({ error: 'Credenziali non valide' });
    return res.json({ token: sign(rows[0]), user: { email: rows[0].email, displayName: rows[0].display_name } });
  }));

  app.get('/api/wallet', requireAuth, wrap(async (req, res) => {
    const [balanceMinor, history] = await Promise.all([
      ledger.getBalance(pool, req.user.accountId),
      ledger.getHistory(pool, req.user.accountId, { limit: 20 }),
    ]);
    res.json({ user: { email: req.user.email, displayName: req.user.displayName }, balanceMinor, transactions: history });
  }));

  app.get('/api/transactions', requireAuth, wrap(async (req, res) => {
    const limit = Number.parseInt(req.query.limit, 10) || 50;
    const before = req.query.before ? Number.parseInt(req.query.before, 10) : null;
    res.json({ transactions: await ledger.getHistory(pool, req.user.accountId, { limit, beforeId: before }) });
  }));

  app.post('/api/transfers', requireAuth, wrap(async (req, res) => {
    const key = String(req.headers['idempotency-key'] || '');
    if (key.length < 8 || key.length > 100) return res.status(400).json({ error: 'Header Idempotency-Key obbligatorio (8-100 caratteri)' });
    const toEmail = String(req.body?.toEmail || '').trim().toLowerCase();
    const memo = String(req.body?.memo || '').slice(0, 140);
    const { rows } = await pool.query('SELECT a.id FROM users u JOIN accounts a ON a.user_id = u.id WHERE u.email = $1', [toEmail]);
    if (!rows.length) return res.status(404).json({ error: 'Destinatario non trovato' });

    const result = await ledger.transfer(pool, {
      fromAccountId: req.user.accountId,
      toAccountId: rows[0].id,
      amountMinor: req.body?.amountMinor,
      kind: 'transfer',
      memo,
      initiatedBy: req.user.id,
      idempotencyKey: key,
    });
    const balanceMinor = await ledger.getBalance(pool, req.user.accountId);
    res.status(result.replayed ? 200 : 201).json({ transactionId: result.transactionId, replayed: result.replayed, balanceMinor });
  }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ledger.LedgerError) return res.status(err.status).json({ error: err.message, code: err.code });
    console.error(err);
    return res.status(500).json({ error: 'Errore interno' });
  });

  return app;
}

module.exports = { createApp };
