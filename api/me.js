const { getSessionUser } = require('../server/auth');
const { send, method, handleError } = require('../server/http');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  try {
    const user = await getSessionUser(req);
    if (!user) return send(res, 401, { ok: false, error: 'UNAUTHENTICATED' });
    return send(res, 200, { ok: true, user });
  } catch (error) {
    return handleError(res, error);
  }
};
