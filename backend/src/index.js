require('dotenv').config();
const { createPool, migrate } = require('./db');
const { createApp } = require('./app');

function createStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // Solo chiavi di test: i pagamenti reali richiedono azienda, KYC e consulenza legale.
  if (!key.startsWith('sk_test_')) throw new Error('STRIPE_SECRET_KEY deve essere una chiave di test (sk_test_...)');
  return require('stripe')(key);
}

async function main() {
  const pool = createPool();
  await migrate(pool);
  const app = createApp(pool, {
    jwtSecret: process.env.JWT_SECRET,
    corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
    welcomeBonusMinor: Number(process.env.WELCOME_BONUS_MINOR || 0),
    stripe: createStripe(),
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    appUrl: process.env.APP_URL || 'https://bitzza-wallet.vercel.app',
  });
  const port = Number(process.env.PORT || 4000);
  app.listen(port, () => console.log(`BITZZA backend in ascolto sulla porta ${port}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
