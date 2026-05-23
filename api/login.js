const { hasDatabase, query, userRow } = require('../server/db');
const { requireSecret, verifyPassword, createSession, SESSION_TTL_SECONDS } = require('../server/auth');
const { send, method, readJson, sessionCookie, handleError, rateLimit } = require('../server/http');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  if (!rateLimit(req, res, 'login', { limit: 20, windowMs: 15 * 60 * 1000 })) return;
  try {
    const body = await readJson(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      return send(res, 400, { ok: false, error: 'MISSING_FIELDS' });
    }
    if (!hasDatabase()) {
      const error = new Error('DATABASE_URL is not configured');
      error.code = 'DB_NOT_CONFIGURED';
      throw error;
    }
    requireSecret();

    const result = await query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);
    const row = result.rows[0];
    if (!row || !verifyPassword(password, row.password_hash)) {
      return send(res, 401, { ok: false, error: 'INVALID_CREDENTIALS' });
    }

    const user = userRow(row);
    const token = await createSession(user.id);
    return send(res, 200, { ok: true, user }, {
      'Set-Cookie': sessionCookie(token, SESSION_TTL_SECONDS)
    });
  } catch (error) {
    return handleError(res, error);
  }
};
