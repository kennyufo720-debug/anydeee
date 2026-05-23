const { hasDatabase, query, userRow } = require('../server/db');
const { requireSecret, hashPassword, createSession, SESSION_TTL_SECONDS } = require('../server/auth');
const { send, method, readJson, sessionCookie, handleError, rateLimit } = require('../server/http');

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  if (!rateLimit(req, res, 'register', { limit: 8, windowMs: 15 * 60 * 1000 })) return;
  try {
    const body = await readJson(req);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!name || !email || !password) {
      return send(res, 400, { ok: false, error: 'MISSING_FIELDS' });
    }
    if (!validateEmail(email)) {
      return send(res, 400, { ok: false, error: 'INVALID_EMAIL' });
    }
    if (password.length < 8) {
      return send(res, 400, { ok: false, error: 'WEAK_PASSWORD' });
    }
    if (!hasDatabase()) {
      const error = new Error('DATABASE_URL is not configured');
      error.code = 'DB_NOT_CONFIGURED';
      throw error;
    }
    requireSecret();

    const inserted = await query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, email, hashPassword(password)]
    ).catch(error => {
      if (error.code === '23505') {
        error.publicCode = 'EMAIL_EXISTS';
      }
      throw error;
    });

    const user = userRow(inserted.rows[0]);
    const token = await createSession(user.id);
    return send(res, 201, { ok: true, user }, {
      'Set-Cookie': sessionCookie(token, SESSION_TTL_SECONDS)
    });
  } catch (error) {
    if (error.publicCode === 'EMAIL_EXISTS') {
      return send(res, 409, { ok: false, error: 'EMAIL_EXISTS' });
    }
    return handleError(res, error);
  }
};
