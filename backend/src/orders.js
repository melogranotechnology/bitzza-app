const express = require('express');
const ledger = require('./ledger');
const pricing = require('./pricing');

const ACTIVE_CUSTOMER = ['open', 'accepted', 'shopping', 'delivering'];
const ACTIVE_COURIER = ['accepted', 'shopping', 'delivering'];
const NEXT = { accepted: 'shopping', shopping: 'delivering', delivering: 'delivered' };
const STEP = { open: 0, accepted: 0, shopping: 1, delivering: 2, delivered: 3, cancelled: 0 };

const fail = (status, code, message) => new ledger.LedgerError(code, message, status);

function present(row) {
  return {
    id: row.id,
    store: row.store,
    area: row.area,
    itemsMinor: Number(row.items_minor),
    weightKg: Number(row.weight_kg),
    distanceKm: Number(row.distance_km),
    vehicle: row.vehicle,
    courierFeeMinor: Number(row.courier_fee_minor),
    commissionMinor: Number(row.commission_minor),
    totalMinor: Number(row.total_minor),
    cashbackMinor: Number(row.cashback_minor),
    status: row.status,
    step: STEP[row.status],
    createdAt: row.created_at,
    customerName: row.customer_name ?? null,
    courierName: row.courier_name ?? null,
  };
}

const SELECT = `SELECT o.*, cu.display_name AS customer_name, co.display_name AS courier_name
                  FROM delivery_orders o
                  JOIN users cu ON cu.id = o.customer_id
                  LEFT JOIN users co ON co.id = o.courier_id`;

function ordersRouter(pool, requireAuth, wrap) {
  const r = express.Router();
  r.use(requireAuth);
  r.param('id', (req, res, next, id) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(404).json({ error: 'Ordine non trovato' });
    }
    return next();
  });

  const systemId = async (client, code) => {
    const { rows } = await client.query('SELECT id FROM accounts WHERE system_code = $1', [code]);
    return rows[0].id;
  };
  const accountOf = async (client, userId) => {
    const { rows } = await client.query('SELECT id FROM accounts WHERE user_id = $1', [userId]);
    return rows[0].id;
  };
  const load = async (client, id) => {
    const { rows } = await client.query(`${SELECT} WHERE o.id = $1`, [id]);
    return rows[0] ? present(rows[0]) : null;
  };

  r.post('/', wrap(async (req, res) => {
    const key = String(req.headers['idempotency-key'] || '');
    if (key.length < 8 || key.length > 100) throw fail(400, 'idempotency_key', 'Idempotency-Key obbligatoria (8-100 caratteri)');
    const store = String(req.body?.store || '').trim().slice(0, 80);
    const area = String(req.body?.area || '').trim().slice(0, 80);
    const { itemsMinor, weightKg, distanceKm, vehicle } = req.body || {};
    if (!store) throw fail(400, 'invalid_store', 'Negozio obbligatorio');
    if (!Number.isSafeInteger(itemsMinor) || itemsMinor <= 0 || itemsMinor > pricing.LIMITS.itemsMinorMax) {
      throw fail(400, 'invalid_items', 'La spesa deve essere tra 0,01 e 500 BITZ');
    }
    if (!(Number(weightKg) > 0 && Number(weightKg) <= pricing.LIMITS.weightKgMax)) throw fail(400, 'invalid_weight', 'Il peso deve essere tra 0 e 50 kg');
    if (!(Number(distanceKm) > 0 && Number(distanceKm) <= pricing.LIMITS.distanceKmMax)) throw fail(400, 'invalid_distance', 'La distanza deve essere tra 0 e 50 km');
    if (!pricing.VEHICLES.includes(vehicle)) throw fail(400, 'invalid_vehicle', 'Mezzo non valido');
    if (!pricing.isSuitable(vehicle, Number(distanceKm))) throw fail(400, 'unsuitable_vehicle', 'Il mezzo scelto non è adatto alla distanza');

    const q = pricing.quote({ itemsMinor, weightKg: Number(weightKg), distanceKm: Number(distanceKm), vehicle });

    const result = await ledger.withTransaction(pool, async (client) => {
      // Blocca l'utente: due ordini simultanei non possono superare il limite di uno attivo.
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
      const existing = await client.query('SELECT id FROM delivery_orders WHERE customer_id = $1 AND idempotency_key = $2', [req.user.id, key]);
      if (existing.rowCount) return { id: existing.rows[0].id, replayed: true };

      const active = await client.query('SELECT 1 FROM delivery_orders WHERE customer_id = $1 AND status = ANY($2)', [req.user.id, ACTIVE_CUSTOMER]);
      if (active.rowCount) throw fail(409, 'order_in_progress', 'Hai già un ordine in corso');

      const ins = await client.query(
        `INSERT INTO delivery_orders (customer_id, store, area, items_minor, weight_kg, distance_km, vehicle,
                                       courier_fee_minor, commission_minor, total_minor, cashback_minor, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [req.user.id, store, area, itemsMinor, weightKg, distanceKm, vehicle, q.courierFeeMinor, q.commissionMinor, q.totalMinor, q.cashbackMinor, key]
      );
      const id = ins.rows[0].id;
      await ledger.postTransfer(client, {
        fromAccountId: req.user.accountId,
        toAccountId: await systemId(client, 'escrow'),
        amountMinor: q.totalMinor,
        kind: 'order_payment',
        memo: `Spesa ${store}`,
        label: 'SpesaGo',
        initiatedBy: req.user.id,
        idempotencyKey: `order-pay-${id}`,
      });
      return { id, replayed: false };
    });
    res.status(result.replayed ? 200 : 201).json({ order: await load(pool, result.id), replayed: result.replayed });
  }));

  r.get('/mine', wrap(async (req, res) => {
    const { rows } = await pool.query(`${SELECT} WHERE o.customer_id = $1 ORDER BY o.created_at DESC LIMIT 50`, [req.user.id]);
    res.json({ orders: rows.map(present) });
  }));

  // Il corriere non vede l'identità del cliente: solo negozio, zona e compenso.
  r.get('/available', wrap(async (req, res) => {
    const { rows } = await pool.query(
      `${SELECT} WHERE o.status = 'open' AND o.customer_id <> $1 ORDER BY o.created_at ASC LIMIT 30`,
      [req.user.id]
    );
    res.json({ orders: rows.map((row) => ({ ...present(row), customerName: null })) });
  }));

  r.get('/deliveries', wrap(async (req, res) => {
    const { rows } = await pool.query(`${SELECT} WHERE o.courier_id = $1 ORDER BY o.updated_at DESC LIMIT 50`, [req.user.id]);
    res.json({ orders: rows.map((row) => ({ ...present(row), customerName: null })) });
  }));

  r.post('/:id/accept', wrap(async (req, res) => {
    await ledger.withTransaction(pool, async (client) => {
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
      const busy = await client.query('SELECT 1 FROM delivery_orders WHERE courier_id = $1 AND status = ANY($2)', [req.user.id, ACTIVE_COURIER]);
      if (busy.rowCount) throw fail(409, 'courier_busy', 'Hai già una consegna in corso');
      const upd = await client.query(
        `UPDATE delivery_orders SET courier_id = $2, status = 'accepted', updated_at = now()
          WHERE id = $1 AND status = 'open' AND customer_id <> $2`,
        [req.params.id, req.user.id]
      );
      if (!upd.rowCount) throw fail(409, 'not_available', 'Ordine non più disponibile');
    });
    res.json({ order: { ...(await load(pool, req.params.id)), customerName: null } });
  }));

  r.post('/:id/advance', wrap(async (req, res) => {
    const expected = String(req.body?.expectedStatus || '');
    const next = NEXT[expected];
    if (!next) throw fail(400, 'invalid_status', 'expectedStatus non valido');

    await ledger.withTransaction(pool, async (client) => {
      const upd = await client.query(
        `UPDATE delivery_orders SET status = $3, updated_at = now()
          WHERE id = $1 AND courier_id = $2 AND status = $4
          RETURNING customer_id, items_minor, courier_fee_minor, commission_minor, cashback_minor, store`,
        [req.params.id, req.user.id, next, expected]
      );
      if (!upd.rowCount) throw fail(409, 'state_changed', 'Lo stato dell\u2019ordine è cambiato');
      if (next !== 'delivered') return;

      const o = upd.rows[0];
      const escrow = await systemId(client, 'escrow');
      const platform = await systemId(client, 'platform');
      const treasury = await systemId(client, 'treasury');
      const customerAccount = await accountOf(client, o.customer_id);
      await ledger.lockAccounts(client, [escrow, platform, treasury, customerAccount, req.user.accountId]);

      const id = req.params.id;
      await ledger.postTransfer(client, {
        fromAccountId: escrow, toAccountId: req.user.accountId,
        amountMinor: Number(o.items_minor) + Number(o.courier_fee_minor),
        kind: 'delivery_payout', memo: `Consegna ${o.store}`, label: 'SpesaGo',
        initiatedBy: req.user.id, idempotencyKey: `order-payout-${id}`,
      });
      if (Number(o.commission_minor) > 0) {
        await ledger.postTransfer(client, {
          fromAccountId: escrow, toAccountId: platform, amountMinor: Number(o.commission_minor),
          kind: 'platform_fee', memo: `Commissione ${o.store}`, label: 'SpesaGo',
          initiatedBy: req.user.id, idempotencyKey: `order-fee-${id}`,
        });
      }
      if (Number(o.cashback_minor) > 0) {
        await ledger.postTransfer(client, {
          fromAccountId: treasury, toAccountId: customerAccount, amountMinor: Number(o.cashback_minor),
          kind: 'cashback', memo: `Cashback spesa ${o.store}`, label: 'SpesaGo',
          initiatedBy: o.customer_id, idempotencyKey: `order-cashback-${id}`,
        });
      }
    });
    res.json({ order: { ...(await load(pool, req.params.id)), customerName: null } });
  }));

  const refund = async (client, orderId, customerId, totalMinor, userId) => {
    await ledger.postTransfer(client, {
      fromAccountId: await systemId(client, 'escrow'),
      toAccountId: await accountOf(client, customerId),
      amountMinor: totalMinor, kind: 'order_refund', memo: 'Rimborso ordine', label: 'SpesaGo',
      initiatedBy: userId, idempotencyKey: `order-refund-${orderId}`,
    });
  };

  // Il corriere può rinunciare finché non ha iniziato la spesa: l'ordine torna disponibile.
  r.post('/:id/release', wrap(async (req, res) => {
    const upd = await pool.query(
      `UPDATE delivery_orders SET courier_id = NULL, status = 'open', updated_at = now()
        WHERE id = $1 AND courier_id = $2 AND status = 'accepted'`,
      [req.params.id, req.user.id]
    );
    if (!upd.rowCount) throw fail(409, 'state_changed', 'Non puoi rinunciare a questa consegna');
    res.json({ ok: true });
  }));

  r.post('/:id/cancel', wrap(async (req, res) => {
    await ledger.withTransaction(pool, async (client) => {
      const upd = await client.query(
        `UPDATE delivery_orders SET status = 'cancelled', updated_at = now()
          WHERE id = $1 AND customer_id = $2 AND status = 'open' RETURNING total_minor`,
        [req.params.id, req.user.id]
      );
      if (!upd.rowCount) throw fail(409, 'state_changed', 'L\u2019ordine non può più essere annullato');
      await refund(client, req.params.id, req.user.id, Number(upd.rows[0].total_minor), req.user.id);
    });
    res.json({ order: await load(pool, req.params.id) });
  }));

  return r;
}

module.exports = { ordersRouter };
