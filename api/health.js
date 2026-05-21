const { send } = require('../server/http');
const { hasDatabase, query } = require('../server/db');

module.exports = async function handler(req, res) {
  if (!hasDatabase()) {
    return send(res, 200, { ok: true, database: 'not_configured' });
  }
  try {
    await query('SELECT 1');
    return send(res, 200, { ok: true, database: 'ready' });
  } catch (error) {
    console.error(error);
    return send(res, 500, { ok: false, database: 'error' });
  }
};
