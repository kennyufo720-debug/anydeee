const { Pool } = require('pg');

let pool;

function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!hasDatabase()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
    });
  }
  return pool;
}

async function query(text, params = []) {
  const db = getPool();
  if (!db) {
    const error = new Error('DATABASE_URL is not configured');
    error.code = 'DB_NOT_CONFIGURED';
    throw error;
  }
  return db.query(text, params);
}

function userRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    kyc: row.kyc_status === 'verified',
    kycStatus: row.kyc_status,
    fa2: Boolean(row.two_factor_enabled),
    avatar: (row.name || row.email || 'U').charAt(0).toUpperCase(),
    anyu: Number(row.anyu_balance || 0),
    createdAt: row.created_at
  };
}

module.exports = { hasDatabase, query, userRow };
