class LedgerError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function assertAmount(amountMinor) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new LedgerError('invalid_amount', 'Importo non valido', 400);
  }
}

// Sposta amountMinor da un conto a un altro in modo atomico. Con la stessa
// idempotencyKey la stessa operazione non viene mai eseguita due volte.
async function transfer(pool, { fromAccountId, toAccountId, amountMinor, kind, memo = '', label = '', initiatedBy = null, idempotencyKey = null }) {
  assertAmount(amountMinor);
  if (fromAccountId === toAccountId) {
    throw new LedgerError('same_account', 'Mittente e destinatario coincidono', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const txn = await client.query(
      `INSERT INTO ledger_transactions (kind, memo, label, initiated_by, idempotency_key)
       VALUES ($1, $2, $5, $3, $4)
       ON CONFLICT (initiated_by, idempotency_key) DO NOTHING
       RETURNING id`,
      [kind, memo, initiatedBy, idempotencyKey, label]
    );

    if (txn.rowCount === 0) {
      const existing = await client.query(
        'SELECT id FROM ledger_transactions WHERE initiated_by = $1 AND idempotency_key = $2',
        [initiatedBy, idempotencyKey]
      );
      await client.query('COMMIT');
      return { transactionId: existing.rows[0].id, replayed: true };
    }

    const transactionId = txn.rows[0].id;
    // Blocco in ordine fisso per evitare deadlock tra trasferimenti incrociati.
    await client.query('SELECT id FROM accounts WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE', [[fromAccountId, toAccountId]]);

    const debit = await client.query('UPDATE accounts SET balance_minor = balance_minor - $2 WHERE id = $1', [fromAccountId, amountMinor]);
    const credit = await client.query('UPDATE accounts SET balance_minor = balance_minor + $2 WHERE id = $1', [toAccountId, amountMinor]);
    if (debit.rowCount !== 1 || credit.rowCount !== 1) {
      throw new LedgerError('account_not_found', 'Conto non trovato', 404);
    }

    await client.query(
      `INSERT INTO ledger_entries (transaction_id, account_id, amount_minor) VALUES ($1, $2, $3), ($1, $4, $5)`,
      [transactionId, fromAccountId, -amountMinor, toAccountId, amountMinor]
    );

    await client.query('COMMIT');
    return { transactionId, replayed: false };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23514') throw new LedgerError('insufficient_funds', 'Saldo insufficiente', 409);
    throw err;
  } finally {
    client.release();
  }
}

async function getBalance(pool, accountId) {
  const { rows } = await pool.query('SELECT balance_minor FROM accounts WHERE id = $1', [accountId]);
  if (!rows.length) throw new LedgerError('account_not_found', 'Conto non trovato', 404);
  return Number(rows[0].balance_minor);
}

async function getHistory(pool, accountId, { limit = 50, beforeId = null } = {}) {
  const { rows } = await pool.query(
    `SELECT e.id, e.amount_minor, t.id AS transaction_id, t.kind, t.memo, t.label, t.created_at,
            COALESCE(cu.display_name, ca.system_code) AS counterparty,
            cu.email AS counterparty_email
       FROM ledger_entries e
       JOIN ledger_transactions t ON t.id = e.transaction_id
       JOIN ledger_entries ce ON ce.transaction_id = e.transaction_id AND ce.account_id <> e.account_id
       JOIN accounts ca ON ca.id = ce.account_id
       LEFT JOIN users cu ON cu.id = ca.user_id
      WHERE e.account_id = $1 AND ($3::bigint IS NULL OR e.id < $3)
      ORDER BY e.id DESC
      LIMIT $2`,
    [accountId, Math.min(Math.max(limit, 1), 200), beforeId]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    transactionId: r.transaction_id,
    amountMinor: Number(r.amount_minor),
    kind: r.kind,
    memo: r.memo,
    label: r.label,
    createdAt: r.created_at,
    counterparty: r.counterparty,
    counterpartyEmail: r.counterparty_email,
  }));
}

// Verifica di coerenza: i saldi in cache devono coincidere con la somma delle voci.
async function auditBalances(pool) {
  const { rows } = await pool.query(
    `SELECT a.id, a.balance_minor, COALESCE(SUM(e.amount_minor), 0) AS ledger_sum
       FROM accounts a LEFT JOIN ledger_entries e ON e.account_id = a.id
      GROUP BY a.id HAVING a.balance_minor <> COALESCE(SUM(e.amount_minor), 0)`
  );
  return rows;
}

module.exports = { LedgerError, transfer, getBalance, getHistory, auditBalances };
