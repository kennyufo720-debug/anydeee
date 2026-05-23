function send(res, status, body, headers = {}) {
  res.statusCode = status;
  Object.entries({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  }).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(body));
}

function method(req, res, allowed) {
  if (allowed.includes(req.method)) return true;
  res.setHeader('Allow', allowed.join(', '));
  send(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  return false;
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      const error = new Error('Invalid JSON body');
      error.code = 'BAD_JSON';
      throw error;
    }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks.map(chunk => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))).toString('utf8'));
  } catch {
    const error = new Error('Invalid JSON body');
    error.code = 'BAD_JSON';
    throw error;
  }
}

function cookie(req, name) {
  const header = req.headers.cookie || '';
  return header.split(';').map(v => v.trim()).reduce((acc, pair) => {
    const idx = pair.indexOf('=');
    if (idx > -1) acc[pair.slice(0, idx)] = decodeURIComponent(pair.slice(idx + 1));
    return acc;
  }, {})[name];
}

function sessionCookie(token, maxAgeSeconds) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `anyd_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secure}`;
}

function clearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `anyd_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

function handleError(res, error) {
  if (error.code === 'DB_NOT_CONFIGURED') {
    return send(res, 503, {
      ok: false,
      error: 'DB_NOT_CONFIGURED',
      message: '資料庫尚未設定，請在 Vercel 設定 DATABASE_URL 後再使用帳號功能。'
    });
  }
  if (error.code === 'AUTH_NOT_CONFIGURED') {
    return send(res, 503, {
      ok: false,
      error: 'AUTH_NOT_CONFIGURED',
      message: 'AUTH_SECRET 尚未設定，請在 Vercel 設定至少 24 字元的 AUTH_SECRET。'
    });
  }
  if (error.code === 'BAD_JSON') {
    return send(res, 400, { ok: false, error: 'BAD_JSON' });
  }
  console.error(error);
  return send(res, 500, { ok: false, error: 'INTERNAL_ERROR' });
}

const buckets = new Map();

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function rateLimit(req, res, key, { limit, windowMs }) {
  const now = Date.now();
  const bucketKey = `${key}:${clientIp(req)}`;
  const current = buckets.get(bucketKey);
  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return true;
  }
  current.count += 1;
  if (current.count <= limit) return true;
  const retryAfter = Math.ceil((current.resetAt - now) / 1000);
  send(res, 429, { ok: false, error: 'RATE_LIMITED', retryAfter }, { 'Retry-After': String(retryAfter) });
  return false;
}

module.exports = { send, method, readJson, cookie, sessionCookie, clearSessionCookie, handleError, rateLimit };
