const crypto = require('crypto');
const { getSessionUser } = require('../server/auth');
const { query } = require('../server/db');
const { send, method, readJson, handleError, rateLimit } = require('../server/http');

function orderRow(row) {
  return {
    id: row.id,
    orderNo: row.order_no,
    item: row.item,
    price: Number(row.price || 0),
    qty: row.qty,
    status: row.status,
    refCode: row.ref_code,
    metadata: row.metadata || {},
    createdAt: row.created_at
  };
}

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET', 'POST'])) return;
  if (!rateLimit(req, res, 'orders', { limit: req.method === 'POST' ? 20 : 120, windowMs: 15 * 60 * 1000 })) return;
  try {
    const user = await getSessionUser(req);
    if (!user) return send(res, 401, { ok: false, error: 'UNAUTHENTICATED' });

    if (req.method === 'GET') {
      const result = await query(
        `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
        [user.id]
      );
      return send(res, 200, { ok: true, orders: result.rows.map(orderRow) });
    }

    const body = await readJson(req);
    const item = String(body.item || '').trim();
    const price = Number(body.price || 0);
    const qty = Math.max(1, Number.parseInt(body.qty || 1, 10));
    if (!item) return send(res, 400, { ok: false, error: 'MISSING_ITEM' });

    const orderNo = `ORD-${Date.now().toString().slice(-8)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const result = await query(
      `INSERT INTO orders (user_id, order_no, item, price, qty, ref_code, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [user.id, orderNo, item, price, qty, body.refCode || null, body.metadata || {}]
    );
    return send(res, 201, { ok: true, order: orderRow(result.rows[0]) });
  } catch (error) {
    return handleError(res, error);
  }
};
