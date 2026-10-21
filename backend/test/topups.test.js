const { createPool, migrate } = require('../src/db');
const { createApp } = require('../src/app');
const ledger = require('../src/ledger');

const DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://localhost/bitzza_test';
let pool, server, base, sessions = {};

const fakeStripe = {
  checkout: { sessions: { create: async (p) => {
    const id = `cs_test_${Object.keys(sessions).length + 1}`;
    sessions[id] = { id, amount_total: p.line_items[0].price_data.unit_amount, currency: 'eur', payment_status: 'paid' };
    return { id, url: `https://checkout.stripe.test/${id}` };
  } } },
  webhooks: { constructEvent: (body, sig) => {
    if (sig !== 'valid') throw new Error('bad sig');
    return JSON.parse(body.toString());
  } },
};

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}
const hook = (event, sig = 'valid') => fetch(`${base}/api/stripe/webhook`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': sig }, body: JSON.stringify(event),
});

beforeAll(async () => {
  pool = createPool(DATABASE_URL);
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(pool);
  const app = createApp(pool, {
    jwtSecret: 'x'.repeat(40), rateLimit: false, stripe: fakeStripe, stripeWebhookSecret: 'whsec_test', appUrl: 'https://app.test',
  });
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => { await new Promise((r) => server.close(r)); await pool.end(); });

test('ricarica: checkout, webhook firmato, accredito una sola volta', async () => {
  const reg = await api('/api/register', { method: 'POST', body: { email: 'topup@example.com', password: 'password-lunga-123' } });
  const token = reg.body.token;
  const co = await api('/api/topups', { method: 'POST', token, body: { amountEur: 20 } });
  expect(co.status).toBe(201);
  const event = { type: 'checkout.session.completed', data: { object: sessions[co.body.sessionId] } };

  expect((await hook(event, 'falsa')).status).toBe(400);
  expect((await api('/api/balance', { token })).body.balance).toBe(0);

  expect((await hook(event)).status).toBe(200);
  expect((await hook(event)).status).toBe(200);
  expect((await api('/api/balance', { token })).body.balance).toBe(20);
  expect((await api('/api/topups', { token })).body.topups[0].status).toBe('paid');
  expect((await ledger.auditBalances(pool)).ok ?? true).toBeTruthy();
});

test('validazione importo, auth e sessione sconosciuta', async () => {
  const reg = await api('/api/register', { method: 'POST', body: { email: 'topup2@example.com', password: 'password-lunga-123' } });
  const token = reg.body.token;
  for (const amountEur of [1, 5000, 10.5, 'abc']) {
    expect((await api('/api/topups', { method: 'POST', token, body: { amountEur } })).status).toBe(400);
  }
  expect((await api('/api/topups', { method: 'POST', body: { amountEur: 10 } })).status).toBe(401);
  const unknown = { type: 'checkout.session.completed', data: { object: { id: 'cs_x', amount_total: 1000, currency: 'eur', payment_status: 'paid' } } };
  expect((await hook(unknown)).status).toBe(200);
});

test('importo del webhook incoerente: nessun accredito', async () => {
  const reg = await api('/api/register', { method: 'POST', body: { email: 'topup3@example.com', password: 'password-lunga-123' } });
  const token = reg.body.token;
  const co = await api('/api/topups', { method: 'POST', token, body: { amountEur: 10 } });
  const bad = { ...sessions[co.body.sessionId], amount_total: 99999 };
  expect((await hook({ type: 'checkout.session.completed', data: { object: bad } })).status).toBe(500);
  expect((await api('/api/balance', { token })).body.balance).toBe(0);
});
