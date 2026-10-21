const { createPool, migrate } = require('../src/db');
const { createApp } = require('../src/app');
const ledger = require('../src/ledger');

const DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://localhost/bitzza_test';
let pool;
let server;
let base;

async function api(path, { method = 'GET', token, body, headers = {} } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

async function register(email, name = 'Utente') {
  const r = await api('/api/register', { method: 'POST', body: { email, password: 'password-lunga-123', displayName: name } });
  expect(r.status).toBe(201);
  return r.body.token;
}

beforeAll(async () => {
  pool = createPool(DATABASE_URL);
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(pool);
  const app = createApp(pool, { jwtSecret: 'x'.repeat(40), welcomeBonusMinor: 10000, rateLimit: false });
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

describe('auth', () => {
  test('registra, accredita il bonus e permette il login', async () => {
    const token = await register('Ada@Example.com', 'Ada');
    const wallet = await api('/api/wallet', { token });
    expect(wallet.body.balanceMinor).toBe(10000);
    expect(wallet.body.transactions[0]).toMatchObject({ kind: 'welcome_bonus', amountMinor: 10000, counterparty: 'treasury' });

    const login = await api('/api/login', { method: 'POST', body: { email: 'ada@example.com', password: 'password-lunga-123' } });
    expect(login.status).toBe(200);
    const bad = await api('/api/login', { method: 'POST', body: { email: 'ada@example.com', password: 'sbagliata-sbagliata' } });
    expect(bad.status).toBe(401);
  });

  test('rifiuta duplicati, password corte e accessi senza token', async () => {
    expect((await api('/api/register', { method: 'POST', body: { email: 'ada@example.com', password: 'password-lunga-123', displayName: 'X' } })).status).toBe(409);
    expect((await api('/api/register', { method: 'POST', body: { email: 'b@example.com', password: 'corta', displayName: 'B' } })).status).toBe(400);
    expect((await api('/api/wallet')).status).toBe(401);
  });
});

describe('trasferimenti', () => {
  test('sposta fondi, è idempotente e blocca saldo insufficiente', async () => {
    const a = await register('alice@example.com', 'Alice');
    await register('bob@example.com', 'Bob');
    const key = 'chiave-0001';

    const first = await api('/api/transfers', { method: 'POST', token: a, headers: { 'Idempotency-Key': key }, body: { toEmail: 'bob@example.com', amountMinor: 2500, memo: 'pizza' } });
    expect(first.status).toBe(201);
    expect(first.body.balanceMinor).toBe(7500);

    const replay = await api('/api/transfers', { method: 'POST', token: a, headers: { 'Idempotency-Key': key }, body: { toEmail: 'bob@example.com', amountMinor: 2500, memo: 'pizza' } });
    expect(replay.status).toBe(200);
    expect(replay.body.replayed).toBe(true);
    expect(replay.body.balanceMinor).toBe(7500);

    const tooMuch = await api('/api/transfers', { method: 'POST', token: a, headers: { 'Idempotency-Key': 'chiave-0002' }, body: { toEmail: 'bob@example.com', amountMinor: 999999 } });
    expect(tooMuch.status).toBe(409);
    expect(tooMuch.body.code).toBe('insufficient_funds');

    const noKey = await api('/api/transfers', { method: 'POST', token: a, body: { toEmail: 'bob@example.com', amountMinor: 1 } });
    expect(noKey.status).toBe(400);
    const decimals = await api('/api/transfers', { method: 'POST', token: a, headers: { 'Idempotency-Key': 'chiave-0003' }, body: { toEmail: 'bob@example.com', amountMinor: 1.5 } });
    expect(decimals.status).toBe(400);
    const self = await api('/api/transfers', { method: 'POST', token: a, headers: { 'Idempotency-Key': 'chiave-0004' }, body: { toEmail: 'alice@example.com', amountMinor: 100 } });
    expect(self.status).toBe(400);
  });

  test('trasferimenti concorrenti non creano né perdono fondi', async () => {
    const c = await register('carol@example.com', 'Carol');
    const d = await register('dave@example.com', 'Dave');
    const jobs = [];
    for (let i = 0; i < 15; i += 1) {
      jobs.push(api('/api/transfers', { method: 'POST', token: c, headers: { 'Idempotency-Key': `c2d-${i}-xxxx` }, body: { toEmail: 'dave@example.com', amountMinor: 1000 } }));
      jobs.push(api('/api/transfers', { method: 'POST', token: d, headers: { 'Idempotency-Key': `d2c-${i}-xxxx` }, body: { toEmail: 'carol@example.com', amountMinor: 700 } }));
    }
    const results = await Promise.all(jobs);
    expect(results.every((r) => [201, 409].includes(r.status))).toBe(true);

    const [cw, dw] = await Promise.all([api('/api/wallet', { token: c }), api('/api/wallet', { token: d })]);
    expect(cw.body.balanceMinor + dw.body.balanceMinor).toBe(20000);
    expect(cw.body.balanceMinor).toBeGreaterThanOrEqual(0);
    expect(dw.body.balanceMinor).toBeGreaterThanOrEqual(0);
    expect(await ledger.auditBalances(pool)).toEqual([]);
  });
});

describe('registro', () => {
  test('le voci sono immutabili', async () => {
    await expect(pool.query('UPDATE ledger_entries SET amount_minor = 1')).rejects.toThrow(/append-only/);
    await expect(pool.query('DELETE FROM ledger_entries')).rejects.toThrow(/append-only/);
  });

  test('una transazione non bilanciata viene rifiutata', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const t = await client.query("INSERT INTO ledger_transactions (kind) VALUES ('bad') RETURNING id");
      const acc = await client.query("SELECT id FROM accounts WHERE system_code = 'treasury'");
      await client.query('INSERT INTO ledger_entries (transaction_id, account_id, amount_minor) VALUES ($1, $2, 5)', [t.rows[0].id, acc.rows[0].id]);
      await expect(client.query('COMMIT')).rejects.toThrow(/non bilanciata/);
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
  });

  test('somma globale del registro = 0', async () => {
    const { rows } = await pool.query('SELECT COALESCE(SUM(amount_minor), 0)::text AS total FROM ledger_entries');
    expect(rows[0].total).toBe('0');
  });
});
