const { destroySession } = require('../server/auth');
const { send, method, clearSessionCookie, handleError } = require('../server/http');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  try {
    await destroySession(req);
    return send(res, 200, { ok: true }, {
      'Set-Cookie': clearSessionCookie()
    });
  } catch (error) {
    return handleError(res, error);
  }
};
