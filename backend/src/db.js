const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('DATABASE_URL non impostata');
  const isLocal = /(localhost|127\.0\.0\.1)/.test(connectionString) || !connectionString.includes('@');
  return new Pool({ connectionString, ssl: isLocal ? false : { rejectUnauthorized: false }, max: 10 });
}

async function migrate(pool) {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await pool.query(sql);
}

module.exports = { createPool, migrate };
