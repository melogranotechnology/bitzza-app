require('dotenv').config();
const { createPool, migrate } = require('./db');

const pool = createPool();
migrate(pool)
  .then(() => console.log('Migrazione completata'))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
