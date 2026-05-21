const crypto = require('crypto');
const { query, userRow } = require('./db');
const { cookie } = require('./http');

const SESSION_COOKIE = 'anyd_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function requireSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 24) {
    const error = new Error('AUTH_SECRET must be at least 24 characters');
    error.code = 'AUTH_NOT_CONFIGURED';
    throw error;
  }
  return secret;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const key = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return `pbkdf2_sha256$120000$${salt}$${key}`;
}

function verifyPassword(password, stored) {
  const [algo, iterations, salt, key] = String(stored || '').split('$');
  if (algo !== 'pbkdf2_sha256' || !iterations || !salt || !key) return false;
  const derived = crypto.pbkdf2Sync(password, salt, Number(iterations), 32, 'sha256');
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), derived);
}

function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function tokenHash(token) {
  return crypto.createHmac('sha256', requireSecret()).update(token).digest('hex');
}

async function createSession(userId) {
  const token = randomToken();
  const hash = tokenHash(token);
  await query(
    'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + make_interval(secs => $3::int))',
    [userId, hash, SESSION_TTL_SECONDS]
  );
  return token;
}

async function getSessionUser(req) {
  const token = cookie(req, SESSION_COOKIE);
  if (!token) return null;
  const hash = tokenHash(token);
  const result = await query(
    `SELECT u.*
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()
      LIMIT 1`,
    [hash]
  );
  return userRow(result.rows[0]);
}

async function destroySession(req) {
  const token = cookie(req, SESSION_COOKIE);
  if (!token) return;
  await query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash(token)]);
}

module.exports = {
  SESSION_TTL_SECONDS,
  requireSecret,
  hashPassword,
  verifyPassword,
  createSession,
  getSessionUser,
  destroySession
};
