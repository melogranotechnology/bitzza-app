require('dotenv').config();
const { createPool, migrate } = require('./db');
const { createApp } = require('./app');

async function main() {
  const pool = createPool();
  await migrate(pool);
  const app = createApp(pool, {
    jwtSecret: process.env.JWT_SECRET,
    corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
    welcomeBonusMinor: Number(process.env.WELCOME_BONUS_MINOR || 0),
  });
  const port = Number(process.env.PORT || 4000);
  app.listen(port, () => console.log(`BITZZA backend in ascolto sulla porta ${port}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
