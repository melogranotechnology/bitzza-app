const { createPool, migrate } = require('../src/db');
const { createApp } = require('../src/app');
const ledger = require('../src/ledger');
const pricing = require('../src/pricing');

const DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://localhost/bitzza_test';
let pool;
let server;
let base;
let counter = 0;

async function api(path, { method = 'GET', token, body, headers = {} } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

async function user(name) {
  const r = await api('/api/register', { method: 'POST', body: { email: `${name}@example.com`, password: 'password-lunga-123', displayName: name } });
  expect(r.status).toBe(201);
  return r.body.token;
}

const balance = async (token) => Math.round((await api('/api/balance', { token })).body.balance * 100);
const systemBalance = async (code) => Number((await pool.query('SELECT balance_minor FROM accounts WHERE system_code = $1', [code])).rows[0].balance_minor);
const place = (token, over = {}) => api('/api/orders', {
  method: 'POST', token, headers: { 'Idempotency-Key': `order-key-${(counter += 1)}-xxxx` },
  body: { store: 'Conad', area: 'Vomero', itemsMinor: 2000, weightKg: 5, distanceKm: 3, vehicle: 'car', ...over },
});
const advance = (token, id, expectedStatus) => api(`/api/orders/${id}/advance`, { method: 'POST', token, body: { expectedStatus } });

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

describe('prezzi', () => {
  test('preventivo coerente con le tariffe SpesaGo', () => {
    expect(pricing.quote({ itemsMinor: 2000, weightKg: 5, distanceKm: 3, vehicle: 'car' })).toEqual({
      courierFeeMinor: 760, commissionMinor: 5, totalMinor: 2765, cashbackMinor: 40,
    });
    expect(pricing.quote({ itemsMinor: 50000, weightKg: 1, distanceKm: 1, vehicle: 'bicycle' }).cashbackMinor).toBe(500);
  });
});

describe('ciclo completo di un ordine', () => {
  test('paga in garanzia, il corriere incassa alla consegna, cashback e commissione', async () => {
    const cust = await user('customer1');
    const cour = await user('courier1');

    const created = await place(cust);
    expect(created.status).toBe(201);
    const o = created.body.order;
    expect(o).toMatchObject({ status: 'open', totalMinor: 2765, courierFeeMinor: 760, cashbackMinor: 40 });
    expect(await balance(cust)).toBe(10000 - 2765);
    expect(await systemBalance('escrow')).toBe(2765);

    // Il corriere vede l'ordine ma non l'identità del cliente.
    const board = await api('/api/orders/available', { token: cour });
    const seen = board.body.orders.find((x) => x.id === o.id);
    expect(seen).toBeTruthy();
    expect(seen.customerName).toBeNull();
    expect((await api('/api/orders/available', { token: cust })).body.orders.find((x) => x.id === o.id)).toBeUndefined();

    expect((await api(`/api/orders/${o.id}/accept`, { method: 'POST', token: cour })).body.order.status).toBe('accepted');
    expect((await advance(cour, o.id, 'accepted')).body.order.status).toBe('shopping');
    expect((await advance(cour, o.id, 'shopping')).body.order.status).toBe('delivering');
    expect(await balance(cour)).toBe(10000);

    const done = await advance(cour, o.id, 'delivering');
    expect(done.body.order.status).toBe('delivered');
    expect(await balance(cour)).toBe(10000 + 2000 + 760);
    expect(await balance(cust)).toBe(10000 - 2765 + 40);
    expect(await systemBalance('escrow')).toBe(0);
    expect(await systemBalance('platform')).toBe(5);

    // Un secondo tocco sulla stessa consegna non paga due volte.
    expect((await advance(cour, o.id, 'delivering')).status).toBe(409);
    expect(await balance(cour)).toBe(10000 + 2760);

    const mine = await api('/api/orders/mine', { token: cust });
    expect(mine.body.orders[0]).toMatchObject({ status: 'delivered', courierName: 'courier1' });
    expect(await ledger.auditBalances(pool)).toEqual([]);
  });
});

describe('regole', () => {
  test('validazione, un solo ordine attivo e saldo insufficiente', async () => {
    const t = await user('rules1');
    expect((await place(t, { itemsMinor: 0 })).status).toBe(400);
    expect((await place(t, { itemsMinor: 100.5 })).status).toBe(400);
    expect((await place(t, { itemsMinor: 60000 })).status).toBe(400);
    expect((await place(t, { vehicle: 'rocket' })).status).toBe(400);
    expect((await place(t, { vehicle: 'walking', distanceKm: 4 })).body.code).toBe('unsuitable_vehicle');
    expect((await place(t, { itemsMinor: 50000 })).body.code).toBe('insufficient_funds');
    expect(await balance(t)).toBe(10000);

    expect((await place(t)).status).toBe(201);
    const second = await place(t);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('order_in_progress');
    expect((await api('/api/orders', { method: 'POST', token: t, body: {} })).status).toBe(400);
    expect((await api('/api/orders/non-un-uuid/accept', { method: 'POST', token: t })).status).toBe(404);
  });

  test('stessa Idempotency-Key = un solo ordine e un solo addebito', async () => {
    const t = await user('idem1');
    const key = 'order-idem-key-1';
    const body = { store: 'Eurospin', area: 'Centro', itemsMinor: 1000, weightKg: 2, distanceKm: 1, vehicle: 'bicycle' };
    const a = await api('/api/orders', { method: 'POST', token: t, headers: { 'Idempotency-Key': key }, body });
    const b = await api('/api/orders', { method: 'POST', token: t, headers: { 'Idempotency-Key': key }, body });
    expect([a.status, b.status]).toEqual([201, 200]);
    expect(b.body.order.id).toBe(a.body.order.id);
    expect(await balance(t)).toBe(10000 - a.body.order.totalMinor);
  });

  test('annullamento rimborsa; dopo l\u2019accettazione non è più possibile', async () => {
    const t = await user('cancel1');
    const c = await user('cancel2');
    const o1 = (await place(t)).body.order;
    expect(await balance(t)).toBeLessThan(10000);
    expect((await api(`/api/orders/${o1.id}/cancel`, { method: 'POST', token: c })).status).toBe(409);
    expect((await api(`/api/orders/${o1.id}/cancel`, { method: 'POST', token: t })).body.order.status).toBe('cancelled');
    expect(await balance(t)).toBe(10000);

    const o2 = (await place(t)).body.order;
    await api(`/api/orders/${o2.id}/accept`, { method: 'POST', token: c });
    expect((await api(`/api/orders/${o2.id}/cancel`, { method: 'POST', token: t })).status).toBe(409);
    // Il corriere può rinunciare prima di iniziare la spesa: l'ordine torna disponibile.
    expect((await api(`/api/orders/${o2.id}/release`, { method: 'POST', token: c })).status).toBe(200);
    expect((await api('/api/orders/available', { token: c })).body.orders.some((x) => x.id === o2.id)).toBe(true);
  });

  test('nessuno può accettare il proprio ordine né avanzare ordini altrui; un corriere = una consegna', async () => {
    const t = await user('guard1');
    const c1 = await user('guard2');
    const c2 = await user('guard3');
    const o = (await place(t)).body.order;
    expect((await api(`/api/orders/${o.id}/accept`, { method: 'POST', token: t })).status).toBe(409);
    expect((await api(`/api/orders/${o.id}/accept`, { method: 'POST', token: c1 })).status).toBe(200);
    expect((await api(`/api/orders/${o.id}/accept`, { method: 'POST', token: c2 })).status).toBe(409);
    expect((await advance(c2, o.id, 'accepted')).status).toBe(409);
    expect((await advance(t, o.id, 'accepted')).status).toBe(409);
    expect((await advance(c1, o.id, 'shopping')).status).toBe(409);
    expect((await advance(c1, o.id, 'bogus')).status).toBe(400);

    const other = await user('guard4');
    const o2 = (await place(other)).body.order;
    const second = await api(`/api/orders/${o2.id}/accept`, { method: 'POST', token: c1 });
    expect(second.body.code).toBe('courier_busy');
  });

  test('10 corrieri contemporanei: ne vince uno solo', async () => {
    const t = await user('race0');
    const o = (await place(t)).body.order;
    const couriers = [];
    for (let i = 0; i < 10; i += 1) couriers.push(await user(`racer${i}`));
    const results = await Promise.all(couriers.map((c) => api(`/api/orders/${o.id}/accept`, { method: 'POST', token: c })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(9);
  });

  test('registro finale: somma zero, saldi coerenti, escrow vuoto salvo ordini aperti', async () => {
    expect(await ledger.auditBalances(pool)).toEqual([]);
    const { rows } = await pool.query('SELECT COALESCE(SUM(amount_minor), 0)::text AS total FROM ledger_entries');
    expect(rows[0].total).toBe('0');
    const open = await pool.query("SELECT COALESCE(SUM(total_minor), 0)::bigint AS t FROM delivery_orders WHERE status IN ('open','accepted','shopping','delivering')");
    expect(await systemBalance('escrow')).toBe(Number(open.rows[0].t));
  });
});
