const express = require('express');
const ledger = require('./ledger');

const MIN_EUR = 5;
const MAX_EUR = 200;

// Il webhook usa il body grezzo: va montato PRIMA di express.json().
function stripeWebhook(pool, stripe, webhookSecret) {
  const router = express.Router();
  router.post('/api/stripe/webhook', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], webhookSecret);
    } catch {
      return res.status(400).json({ error: 'Firma non valida' });
    }
    try {
      if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
        await creditTopup(pool, event.data.object);
      }
      return res.json({ received: true });
    } catch (err) {
      console.error('Webhook Stripe fallito:', err.message);
      return res.status(500).json({ error: 'Errore interno' });
    }
  });
  return router;
}

async function creditTopup(pool, session) {
  if (session.payment_status !== 'paid') return;
  await ledger.withTransaction(pool, async (client) => {
    const { rows } = await client.query(
      `SELECT t.id, t.user_id, t.amount_cents, t.status, a.id AS account_id
         FROM topups t JOIN accounts a ON a.user_id = t.user_id
        WHERE t.stripe_session_id = $1 FOR UPDATE OF t`,
      [session.id]
    );
    const topup = rows[0];
    if (!topup || topup.status === 'paid') return;
    if (Number(session.amount_total) !== Number(topup.amount_cents) || session.currency !== 'eur') {
      throw new Error(`Importo non coerente per la sessione ${session.id}`);
    }
    const treasury = await client.query("SELECT id FROM accounts WHERE system_code = 'treasury'");
    await ledger.postTransfer(client, {
      fromAccountId: treasury.rows[0].id,
      toAccountId: topup.account_id,
      amountMinor: Number(topup.amount_cents),
      kind: 'topup',
      memo: 'Ricarica con carta (Stripe test)',
      label: 'Ricarica',
      initiatedBy: topup.user_id,
      idempotencyKey: `stripe-${session.id}`,
    });
    await client.query("UPDATE topups SET status = 'paid', paid_at = now() WHERE id = $1", [topup.id]);
  });
}

function topupsRouter(pool, requireAuth, wrap, { stripe, appUrl }) {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/config', (req, res) => res.json({ enabled: Boolean(stripe), minEur: MIN_EUR, maxEur: MAX_EUR, rate: '1 EUR = 1 BITZ' }));

  router.post('/', wrap(async (req, res) => {
    if (!stripe) return res.status(503).json({ error: 'Ricariche non configurate' });
    const eur = Number(req.body?.amountEur);
    if (!Number.isInteger(eur) || eur < MIN_EUR || eur > MAX_EUR) {
      return res.status(400).json({ error: `Importo da ${MIN_EUR} a ${MAX_EUR} euro (intero)` });
    }
    const cents = eur * 100;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: req.user.id,
      customer_email: req.user.email,
      line_items: [{
        quantity: 1,
        price_data: { currency: 'eur', unit_amount: cents, product_data: { name: `Ricarica BITZZA (${eur} BITZ)` } },
      }],
      success_url: `${appUrl}/?topup=success`,
      cancel_url: `${appUrl}/?topup=cancel`,
    });
    await pool.query('INSERT INTO topups (user_id, stripe_session_id, amount_cents) VALUES ($1, $2, $3)', [req.user.id, session.id, cents]);
    res.status(201).json({ url: session.url, sessionId: session.id });
  }));

  router.get('/', wrap(async (req, res) => {
    const { rows } = await pool.query(
      'SELECT id, amount_cents, status, created_at, paid_at FROM topups WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    );
    res.json({ topups: rows.map((r) => ({ id: r.id, amountEur: Number(r.amount_cents) / 100, status: r.status, createdAt: r.created_at, paidAt: r.paid_at })) });
  }));
  return router;
}

module.exports = { stripeWebhook, topupsRouter, creditTopup };
