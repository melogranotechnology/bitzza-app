const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'bitzza-tests-'));
process.env.JWT_SECRET = 'test-secret-value-with-more-than-32-characters';
process.env.DB_PATH = path.join(testDirectory, 'bitzza-test.db');

const { app, db } = require('../server');

let server;
let baseUrl;

const request = (pathname, { method = 'GET', body, token, idempotencyKey } = {}) => new Promise((resolve, reject) => {
  const url = new URL(pathname, baseUrl);
  const req = http.request(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }, (res) => {
    let responseBody = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => { responseBody += chunk; });
    res.on('end', () => resolve({
      status: res.statusCode,
      body: responseBody ? JSON.parse(responseBody) : null,
    }));
  });

  req.on('error', reject);
  if (body) req.write(JSON.stringify(body));
  req.end();
});

beforeAll(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  await new Promise((resolve, reject) => {
    db.close((error) => error ? reject(error) : resolve());
  });
  fs.rmSync(testDirectory, { recursive: true, force: true });
});

test('health check, registration, login, and authenticated wallet operations work', async () => {
  const health = await request('/health');
  expect(health.status).toBe(200);
  expect(health.body.status).toBe('OK');

  const email = `wallet-${Date.now()}@example.test`;
  const registration = await request('/api/register', {
    method: 'POST',
    body: { email: email.toUpperCase(), password: 'wallet-password' },
  });
  expect(registration.status).toBe(201);
  expect(registration.body.token).toEqual(expect.any(String));
  const token = registration.body.token;

  const balance = await request('/api/balance', { token });
  expect(balance.status).toBe(200);
  expect(balance.body.balance).toBe(100);

  const login = await request('/api/login', {
    method: 'POST',
    body: { email, password: 'wallet-password' },
  });
  expect(login.status).toBe(200);
  expect(login.body.token).toEqual(expect.any(String));

  const unauthorized = await request('/api/balance');
  expect(unauthorized.status).toBe(401);

});

test('payment, contacts, settings, commodities, mining, market, and export endpoints work', async () => {
  const senderEmail = `sender-${Date.now()}@example.test`;
  const recipientEmail = `recipient-${Date.now()}@example.test`;
  const sender = await request('/api/register', {
    method: 'POST',
    body: { email: senderEmail, password: 'wallet-password' },
  });
  const recipient = await request('/api/register', {
    method: 'POST',
    body: { email: recipientEmail, password: 'wallet-password' },
  });
  const senderToken = sender.body.token;

  const payment = await request('/api/send', {
    method: 'POST',
    token: senderToken,
    body: { amount: 12.5, recipientEmail, description: 'Test payment' },
  });
  expect(payment.status).toBe(200);

  const senderBalance = await request('/api/balance', { token: senderToken });
  const recipientBalance = await request('/api/balance', { token: recipient.body.token });
  expect(senderBalance.body.balance).toBe(87.5);
  expect(recipientBalance.body.balance).toBe(112.5);

  const transactions = await request('/api/transactions?search=Test', { token: senderToken });
  expect(transactions.body.transactions).toHaveLength(1);
  expect(transactions.body.transactions[0].otherParty).toBe(recipientEmail);
  expect(transactions.body.pagination.total).toBe(1);

  const insufficientPayment = await request('/api/send', {
    method: 'POST',
    token: senderToken,
    body: { amount: 1000, recipientEmail },
  });
  expect(insufficientPayment.status).toBe(400);

  const contactSave = await request('/api/address-book', {
    method: 'POST',
    token: senderToken,
    body: { label: 'Recipient', address: recipientEmail.toUpperCase() },
  });
  expect(contactSave.status).toBe(200);
  const contacts = await request('/api/address-book', { token: senderToken });
  expect(contacts.body.contacts[0].address).toBe(recipientEmail);
  const contactDelete = await request(`/api/address-book/${contactSave.body.id}`, {
    method: 'DELETE',
    token: senderToken,
  });
  expect(contactDelete.status).toBe(200);

  const currentSettings = await request('/api/user/settings', { token: senderToken });
  expect(currentSettings.body.theme).toBe('light');
  const updatedSettings = await request('/api/user/settings', {
    method: 'PUT',
    token: senderToken,
    body: { theme: 'dark', notifications_enabled: false, default_slippage: 2 },
  });
  expect(updatedSettings.body.theme).toBe('dark');
  expect(updatedSettings.body.notifications_enabled).toBe(0);
  const badSettings = await request('/api/user/settings', {
    method: 'PUT',
    token: senderToken,
    body: { default_slippage: 99 },
  });
  expect(badSettings.status).toBe(400);

  const bought = await request('/api/commodities/buy', {
    method: 'POST',
    token: senderToken,
    body: { commodity: 'Pomodoro', units: 2 },
  });
  expect(bought.status).toBe(200);
  expect(bought.body.newHolding).toBe(2);
  const sold = await request('/api/commodities/sell', {
    method: 'POST',
    token: senderToken,
    body: { commodity: 'Pomodoro', units: 1 },
  });
  expect(sold.status).toBe(200);
  expect(sold.body.newHolding).toBe(1);
  expect(sold.body.bitzReceived).toBe(1.9);

  const miningStatus = await request('/api/mining/status', { token: senderToken });
  expect(miningStatus.status).toBe(200);
  expect(miningStatus.body.canClaim).toBe(true);
  const miningClaims = await Promise.all([
    request('/api/mining/claim', { method: 'POST', token: senderToken }),
    request('/api/mining/claim', { method: 'POST', token: senderToken }),
  ]);
  expect(miningClaims.map((claim) => claim.status).sort()).toEqual([200, 429]);
  expect(miningClaims.find((claim) => claim.status === 200).body.amount).toBe(0.5);
  const cooldownStatus = await request('/api/mining/status', { token: senderToken });
  expect(cooldownStatus.body.canClaim).toBe(false);

  const tokenInfo = await request('/api/token/info');
  const market = await request('/api/market/data');
  const history = await request('/api/market/history');
  const target = await request('/api/pizza/target');
  expect(tokenInfo.body.symbol).toBe('BITZ');
  expect(market.body.price_usd).toBeGreaterThan(0);
  expect(history.body.history.length).toBeGreaterThan(0);
  expect(target.body.target_usd).toBe(12.5);

  const exportedWallet = await request('/api/wallet/export', { token: senderToken });
  expect(exportedWallet.body.user.email).toBe(senderEmail);
  expect(exportedWallet.body.transactions).toHaveLength(1);

  const concurrentPayments = await Promise.all([
    request('/api/send', {
      method: 'POST',
      token: senderToken,
      body: { amount: 60, recipientEmail },
    }),
    request('/api/send', {
      method: 'POST',
      token: senderToken,
      body: { amount: 60, recipientEmail },
    }),
  ]);
  expect(concurrentPayments.map((payment) => payment.status).sort()).toEqual([200, 400]);
  const finalSenderBalance = await request('/api/balance', { token: senderToken });
  expect(finalSenderBalance.body.balance).toBeGreaterThanOrEqual(0);
});

test('payment idempotency and pizza voucher purchase, redemption, and settlement are safe', async () => {
  const suffix = Date.now();
  const customer = await request('/api/register', {
    method: 'POST',
    body: { email: `pizza-customer-${suffix}@example.test`, password: 'wallet-password' },
  });
  const merchant = await request('/api/register', {
    method: 'POST',
    body: { email: `pizza-merchant-${suffix}@example.test`, password: 'wallet-password' },
  });
  const otherMerchant = await request('/api/register', {
    method: 'POST',
    body: { email: `other-merchant-${suffix}@example.test`, password: 'wallet-password' },
  });

  const merchantProfile = await request('/api/pizza/merchant', {
    method: 'POST',
    token: merchant.body.token,
    body: { name: 'Demo Pizzeria', location: 'Rome' },
  });
  const otherMerchantProfile = await request('/api/pizza/merchant', {
    method: 'POST',
    token: otherMerchant.body.token,
    body: { name: 'Second Pizzeria', location: 'Milan' },
  });
  expect(merchantProfile.status).toBe(200);
  expect(otherMerchantProfile.status).toBe(200);

  const menu = await request('/api/pizza/menu');
  expect(menu.body.demo).toBe(true);
  expect(menu.body.products[0].price).toBe(12.5);
  expect(menu.body.products[0].allergens).toContain('glutine');

  const requestId = `voucher-${suffix}-request`;
  const purchase = await request('/api/pizza/vouchers', {
    method: 'POST',
    token: customer.body.token,
    body: { merchantId: merchantProfile.body.merchant.id, requestId },
  });
  expect(purchase.status).toBe(201);
  expect(purchase.body.voucher.code).toMatch(/^BZ-[A-F0-9]{16}$/);
  const replay = await request('/api/pizza/vouchers', {
    method: 'POST',
    token: customer.body.token,
    body: { merchantId: merchantProfile.body.merchant.id, requestId },
  });
  expect(replay.status).toBe(200);
  expect(replay.body.voucher.code).toBe(purchase.body.voucher.code);
  expect((await request('/api/balance', { token: customer.body.token })).body.balance).toBe(87.5);

  const wrongPizzeria = await request('/api/pizza/pos/redeem', {
    method: 'POST',
    token: otherMerchant.body.token,
    body: { code: purchase.body.voucher.code },
  });
  expect(wrongPizzeria.status).toBe(400);
  const redemption = await request('/api/pizza/pos/redeem', {
    method: 'POST',
    token: merchant.body.token,
    body: { code: purchase.body.voucher.code },
  });
  expect(redemption.status).toBe(200);
  expect(redemption.body.sale.amount).toBe(12.5);

  const duplicateRedemption = await request('/api/pizza/pos/redeem', {
    method: 'POST',
    token: merchant.body.token,
    body: { code: purchase.body.voucher.code },
  });
  expect(duplicateRedemption.status).toBe(409);
  const merchantAfterSale = await request('/api/pizza/merchant', { token: merchant.body.token });
  expect(merchantAfterSale.body.merchant.balance).toBe(12.5);
  expect(merchantAfterSale.body.sales).toHaveLength(1);
  const customerVouchers = await request('/api/pizza/vouchers', { token: customer.body.token });
  expect(customerVouchers.body.vouchers[0].status).toBe('redeemed');

  const recipient = await request('/api/register', {
    method: 'POST',
    body: { email: `idempotent-recipient-${suffix}@example.test`, password: 'wallet-password' },
  });
  const paymentKey = `payment-${suffix}-idempotency`;
  const payment = await request('/api/send', {
    method: 'POST',
    token: customer.body.token,
    idempotencyKey: paymentKey,
    body: { amount: 10, recipientEmail: `idempotent-recipient-${suffix}@example.test`, description: 'Replay-safe' },
  });
  const paymentReplay = await request('/api/send', {
    method: 'POST',
    token: customer.body.token,
    idempotencyKey: paymentKey,
    body: { amount: 10, recipientEmail: `idempotent-recipient-${suffix}@example.test`, description: 'Replay-safe' },
  });
  expect(payment.status).toBe(200);
  expect(paymentReplay.body.replayed).toBe(true);
  expect(paymentReplay.body.transactionId).toBe(payment.body.transactionId);
  const concurrentKey = `concurrent-${suffix}-payment`;
  const concurrentReplays = await Promise.all([
    request('/api/send', {
      method: 'POST',
      token: customer.body.token,
      idempotencyKey: concurrentKey,
      body: { amount: 5, recipientEmail: `idempotent-recipient-${suffix}@example.test` },
    }),
    request('/api/send', {
      method: 'POST',
      token: customer.body.token,
      idempotencyKey: concurrentKey,
      body: { amount: 5, recipientEmail: `idempotent-recipient-${suffix}@example.test` },
    }),
  ]);
  expect(concurrentReplays.map((result) => result.status)).toEqual([200, 200]);
  expect(concurrentReplays[0].body.transactionId).toBe(concurrentReplays[1].body.transactionId);
  const reusedKey = await request('/api/send', {
    method: 'POST',
    token: customer.body.token,
    idempotencyKey: paymentKey,
    body: { amount: 11, recipientEmail: `idempotent-recipient-${suffix}@example.test`, description: 'Different payment' },
  });
  expect(reusedKey.status).toBe(409);
  expect((await request('/api/balance', { token: customer.body.token })).body.balance).toBe(72.5);
  expect((await request('/api/balance', { token: recipient.body.token })).body.balance).toBe(115);
});

test('registration validates passwords and duplicate emails', async () => {
  const invalid = await request('/api/register', {
    method: 'POST',
    body: { email: 'bad-email', password: 'short' },
  });
  expect(invalid.status).toBe(400);

  const email = `duplicate-${Date.now()}@example.test`;
  const first = await request('/api/register', {
    method: 'POST',
    body: { email, password: 'wallet-password' },
  });
  expect(first.status).toBe(201);
  const duplicate = await request('/api/register', {
    method: 'POST',
    body: { email: email.toUpperCase(), password: 'wallet-password' },
  });
  expect(duplicate.status).toBe(409);
});
