const express = require('express');
const crypto = require('node:crypto');
const ledger = require('./ledger');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const toBitz = (minor) => Number(minor) / 100;
const notAvailable = (res) =>
  res.status(501).json({ error: 'Funzione non ancora disponibile nel backend reale', code: 'not_available' });

// Dati di mercato simulati ma deterministici: nessun saldo dipende da questi valori.
function marketPoint(offsetSteps = 0) {
  const step = Math.floor(Date.now() / 30000) - offsetSteps;
  const price = 12.5 + Math.sin(step / 40) * 0.6 + Math.sin(step / 7) * 0.15;
  const prev = 12.5 + Math.sin((step - 1) / 40) * 0.6 + Math.sin((step - 1) / 7) * 0.15;
  return {
    id: step,
    price_usd: Number(price.toFixed(4)),
    market_cap: Math.round(price * 1000000),
    volume_24h: Math.round(price * 1000000 * 0.18),
    change_24h: Number((((price - prev) / prev) * 100).toFixed(2)),
    timestamp: new Date(step * 30000).toISOString(),
  };
}

function legacyRouter(pool, requireAuth, wrap) {
  const r = express.Router();

  r.get('/profile', requireAuth, wrap(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.wallet_address, u.created_at,
              s.theme, s.notifications_enabled, s.privacy_mode, s.default_slippage
         FROM users u LEFT JOIN user_settings s ON s.user_id = u.id WHERE u.id = $1`,
      [req.user.id]
    );
    const u = rows[0];
    res.json({
      id: u.id, email: u.email, wallet_address: u.wallet_address, created_at: u.created_at,
      settings: { theme: u.theme || 'light', notifications_enabled: u.notifications_enabled ?? 1, privacy_mode: u.privacy_mode ?? 0, default_slippage: Number(u.default_slippage ?? 0.5) },
    });
  }));

  r.get('/balance', requireAuth, wrap(async (req, res) => {
    const minor = await ledger.getBalance(pool, req.user.accountId);
    res.json({ userId: req.user.id, balance: toBitz(minor), currency: 'BITZ' });
  }));

  r.post('/send', requireAuth, wrap(async (req, res) => {
    const { amount, recipientEmail, description, label } = req.body || {};
    const key = String(req.headers['idempotency-key'] || '');
    if (key.length < 8 || key.length > 100) return res.status(400).json({ error: 'Idempotency-Key obbligatoria (8-100 caratteri)' });
    if (amount === undefined || !recipientEmail) return res.status(400).json({ error: 'Importo e destinatario obbligatori' });
    const amt = Number(amount);
    const minor = Math.round(amt * 100);
    if (!Number.isFinite(amt) || amt <= 0 || Math.abs(minor - amt * 100) > 1e-6) {
      return res.status(400).json({ error: 'L\u2019importo deve essere positivo con al massimo due decimali' });
    }
    const email = String(recipientEmail).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Email destinatario non valida' });
    const { rows } = await pool.query('SELECT a.id FROM users u JOIN accounts a ON a.user_id = u.id WHERE u.email = $1', [email]);
    if (!rows.length) return res.status(404).json({ error: 'Destinatario non trovato' });

    const result = await ledger.transfer(pool, {
      fromAccountId: req.user.accountId,
      toAccountId: rows[0].id,
      amountMinor: minor,
      kind: 'transfer',
      memo: String(description || '').slice(0, 140),
      label: String(label || '').slice(0, 60),
      initiatedBy: req.user.id,
      idempotencyKey: key,
    });
    res.status(result.replayed ? 200 : 201).json({
      message: result.replayed ? 'Pagamento gi\u00e0 elaborato' : 'Pagamento inviato',
      transactionId: result.transactionId,
      replayed: result.replayed,
    });
  }));

  // Sostituisce /api/transactions della versione base: stesso formato delle app esistenti.
  r.get('/transactions', requireAuth, wrap(async (req, res) => {
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, Number.parseInt(req.query.offset, 10) || 0);
    const type = req.query.type;
    const search = req.query.search ? `%${String(req.query.search).slice(0, 60)}%` : null;
    const where = `e.account_id = $1
      AND ($2::text IS NULL OR ($2 = 'sent' AND e.amount_minor < 0) OR ($2 = 'received' AND e.amount_minor > 0))
      AND ($3::text IS NULL OR t.memo ILIKE $3 OR t.label ILIKE $3)`;
    const params = [req.user.accountId, ['sent', 'received'].includes(type) ? type : null, search];
    const [list, count] = await Promise.all([
      pool.query(
        `SELECT e.id, e.amount_minor, t.memo, t.label, t.created_at,
                COALESCE(cu.email, CASE ca.system_code WHEN 'escrow' THEN 'SpesaGo (garanzia)' WHEN 'platform' THEN 'BITZZA' ELSE 'BITZZA Treasury' END) AS other_party
           FROM ledger_entries e
           JOIN ledger_transactions t ON t.id = e.transaction_id
           JOIN ledger_entries ce ON ce.transaction_id = e.transaction_id AND ce.account_id <> e.account_id
           JOIN accounts ca ON ca.id = ce.account_id
           LEFT JOIN users cu ON cu.id = ca.user_id
          WHERE ${where}
          ORDER BY e.id DESC LIMIT $4 OFFSET $5`,
        [...params, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM ledger_entries e JOIN ledger_transactions t ON t.id = e.transaction_id WHERE ${where}`,
        params
      ),
    ]);
    res.json({
      transactions: list.rows.map((row) => ({
        id: Number(row.id),
        amount: Math.abs(toBitz(row.amount_minor)),
        type: Number(row.amount_minor) < 0 ? 'sent' : 'received',
        description: row.memo,
        label: row.label,
        createdAt: row.created_at,
        otherParty: row.other_party,
      })),
      pagination: { total: count.rows[0].total, limit, offset },
    });
  }));

  r.get('/wallet/export', requireAuth, wrap(async (req, res) => {
    const minor = await ledger.getBalance(pool, req.user.accountId);
    const history = await ledger.getHistory(pool, req.user.accountId, { limit: 200 });
    res.json({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      user: { email: req.user.email, balance: toBitz(minor) },
      transactions: history.map((h) => ({
        id: h.id, amount: Math.abs(toBitz(h.amountMinor)), type: h.amountMinor < 0 ? 'sent' : 'received',
        description: h.memo, label: h.label, createdAt: h.createdAt, otherParty: h.counterpartyEmail || 'BITZZA Treasury',
      })),
    });
  }));

  r.get('/address-book', requireAuth, wrap(async (req, res) => {
    const { rows } = await pool.query('SELECT id, label, address, created_at FROM address_book WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json({ contacts: rows.map((c) => ({ ...c, id: Number(c.id) })) });
  }));

  r.post('/address-book', requireAuth, wrap(async (req, res) => {
    const label = String(req.body?.label || '').trim().slice(0, 60);
    const address = String(req.body?.address || '').trim().toLowerCase();
    if (!label || !address) return res.status(400).json({ error: 'Nome e indirizzo obbligatori' });
    if (!EMAIL_RE.test(address)) return res.status(400).json({ error: 'Email non valida' });
    const { rows } = await pool.query(
      `INSERT INTO address_book (user_id, label, address) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, address) DO UPDATE SET label = EXCLUDED.label RETURNING id`,
      [req.user.id, label, address]
    );
    res.json({ message: 'Contatto salvato', id: Number(rows[0].id) });
  }));

  r.delete('/address-book/:id', requireAuth, wrap(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(id)) return res.status(404).json({ error: 'Contatto non trovato' });
    const out = await pool.query('DELETE FROM address_book WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (!out.rowCount) return res.status(404).json({ error: 'Contatto non trovato' });
    return res.json({ message: 'Contatto eliminato' });
  }));

  const readSettings = async (userId) => {
    await pool.query('INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
    const { rows } = await pool.query('SELECT theme, notifications_enabled, privacy_mode, default_slippage FROM user_settings WHERE user_id = $1', [userId]);
    return { ...rows[0], default_slippage: Number(rows[0].default_slippage) };
  };

  r.get('/user/settings', requireAuth, wrap(async (req, res) => res.json(await readSettings(req.user.id))));

  r.put('/user/settings', requireAuth, wrap(async (req, res) => {
    const { theme, notifications_enabled: notif, privacy_mode: priv, default_slippage: slip } = req.body || {};
    if (theme !== undefined && !['light', 'dark', 'system'].includes(theme)) return res.status(400).json({ error: 'Tema non valido' });
    if (notif !== undefined && ![0, 1, false, true].includes(notif)) return res.status(400).json({ error: 'notifications_enabled non valido' });
    if (priv !== undefined && ![0, 1, false, true].includes(priv)) return res.status(400).json({ error: 'privacy_mode non valido' });
    if (slip !== undefined && (!Number.isFinite(Number(slip)) || Number(slip) < 0 || Number(slip) > 50)) {
      return res.status(400).json({ error: 'default_slippage deve essere tra 0 e 50' });
    }
    await readSettings(req.user.id);
    await pool.query(
      `UPDATE user_settings SET theme = COALESCE($2, theme), notifications_enabled = COALESCE($3, notifications_enabled),
         privacy_mode = COALESCE($4, privacy_mode), default_slippage = COALESCE($5, default_slippage), updated_at = now()
       WHERE user_id = $1`,
      [req.user.id, theme ?? null, notif === undefined ? null : Number(Boolean(notif)), priv === undefined ? null : Number(Boolean(priv)), slip ?? null]
    );
    res.json(await readSettings(req.user.id));
  }));

  // Dati pubblici di mercato (simulati).
  r.get('/token/info', (req, res) => res.json({
    name: 'BITZZA', symbol: 'BITZ', decimals: 2, total_supply: 1000000, contract_address: null,
  }));
  r.get('/market/data', (req, res) => res.json(marketPoint()));
  r.get('/market/history', (req, res) => {
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 30));
    const history = Array.from({ length: limit }, (_, i) => marketPoint(limit - 1 - i));
    res.json({ history });
  });
  r.get('/pizza/target', (req, res) => {
    const target = 12.5;
    const current = marketPoint().price_usd;
    res.json({
      target_usd: target, current_usd: current,
      percentage: Number(Math.min(100, (current / target) * 100).toFixed(2)),
      reached: current >= target,
      message: current >= target ? 'Traguardo raggiunto!' : `Mancano $ ${(target - current).toFixed(2)}`,
    });
  });
  r.get('/pizza/menu', (req, res) => res.json({
    currency: 'BITZ', demo: true,
    products: [{
      id: 'pizza-voucher', name: 'Voucher pizza',
      description: 'Prepagamento demo per una pizza presso la pizzeria selezionata.',
      price: 12.5, ingredients: ['grano', 'pomodoro', 'latticini'], allergens: ['glutine', 'latte'],
      disclosure: 'Ingredienti e allergeni sono illustrativi: verificare sempre le informazioni presso il venditore.',
    }],
  }));

  // Funzioni non ancora portate sul registro reale: le letture restano vuote, le azioni sono rifiutate.
  r.get('/pizza/merchants', (req, res) => res.json({ merchants: [] }));
  r.get('/pizza/merchant', requireAuth, (req, res) => res.json({ merchant: null, sales: [] }));
  r.get('/pizza/vouchers', requireAuth, (req, res) => res.json({ vouchers: [] }));
  r.get('/commodities', requireAuth, (req, res) => res.json({ holdings: { Pomodoro: 0, Grano: 0, Latte: 0 } }));
  r.get('/mining/status', requireAuth, (req, res) => res.json({
    canClaim: false, secondsRemaining: 0, totalMined: 0, totalClaims: 0, currentDifficulty: 1, nextReward: 0,
  }));
  for (const path of ['/pizza/merchant', '/pizza/vouchers', '/pizza/pos/redeem', '/commodities/buy', '/commodities/sell', '/mining/claim']) {
    r.post(path, requireAuth, (req, res) => notAvailable(res));
  }

  return r;
}

const newWalletAddress = () => `0x${crypto.randomBytes(20).toString('hex')}`;

module.exports = { legacyRouter, newWalletAddress };
