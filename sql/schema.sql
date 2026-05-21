CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER',
  kyc_status TEXT NOT NULL DEFAULT 'not_submitted',
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  anyu_balance NUMERIC(20, 6) NOT NULL DEFAULT 128400,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_no TEXT NOT NULL UNIQUE,
  item TEXT NOT NULL,
  price NUMERIC(20, 6) NOT NULL DEFAULT 0,
  qty INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  ref_code TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_user_id_created_at_idx ON orders(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tx_type TEXT NOT NULL,
  amount NUMERIC(20, 6) NOT NULL,
  symbol TEXT NOT NULL DEFAULT 'ANYU',
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_user_id_created_at_idx ON transactions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kyc_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  country TEXT,
  phone TEXT,
  address TEXT,
  document_type TEXT NOT NULL DEFAULT 'id',
  document_front_url TEXT,
  document_back_url TEXT,
  selfie_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS kyc_requests_user_id_created_at_idx ON kyc_requests(user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS kyc_requests_status_idx ON kyc_requests(status);

CREATE TABLE IF NOT EXISTS wallet_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_type TEXT NOT NULL DEFAULT 'internal',
  label TEXT,
  address TEXT,
  chain TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, wallet_type, chain, address)
);

CREATE INDEX IF NOT EXISTS wallet_accounts_user_id_idx ON wallet_accounts(user_id);

CREATE TABLE IF NOT EXISTS wallet_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  available NUMERIC(28, 8) NOT NULL DEFAULT 0,
  locked NUMERIC(28, 8) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, symbol)
);

CREATE INDEX IF NOT EXISTS wallet_balances_user_id_idx ON wallet_balances(user_id);

CREATE TABLE IF NOT EXISTS deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL DEFAULT 'ANYU',
  amount NUMERIC(28, 8) NOT NULL,
  chain TEXT,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS deposits_user_id_created_at_idx ON deposits(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS deposits_status_idx ON deposits(status);

CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL DEFAULT 'ANYU',
  amount NUMERIC(28, 8) NOT NULL,
  chain TEXT,
  to_address TEXT NOT NULL,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS withdrawals_user_id_created_at_idx ON withdrawals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS withdrawals_status_idx ON withdrawals(status);

CREATE TABLE IF NOT EXISTS asset_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'forest',
  description TEXT,
  issuer TEXT,
  chain TEXT,
  contract_address TEXT,
  image_url TEXT,
  floor_price NUMERIC(20, 6) NOT NULL DEFAULT 0,
  total_supply INTEGER,
  minted_supply INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS asset_series_category_idx ON asset_series(category);
CREATE INDEX IF NOT EXISTS asset_series_status_idx ON asset_series(status);

CREATE TABLE IF NOT EXISTS asset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES asset_series(id) ON DELETE CASCADE,
  token_no INTEGER NOT NULL,
  token_uri TEXT,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'minted',
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  minted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(series_id, token_no)
);

CREATE INDEX IF NOT EXISTS asset_tokens_owner_user_id_idx ON asset_tokens(owner_user_id);
CREATE INDEX IF NOT EXISTS asset_tokens_series_id_idx ON asset_tokens(series_id);

CREATE TABLE IF NOT EXISTS holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  series_id UUID REFERENCES asset_series(id) ON DELETE SET NULL,
  token_id UUID REFERENCES asset_tokens(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  quantity NUMERIC(28, 8) NOT NULL DEFAULT 1,
  avg_cost NUMERIC(20, 6) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, token_id)
);

CREATE INDEX IF NOT EXISTS holdings_user_id_idx ON holdings(user_id);
CREATE INDEX IF NOT EXISTS holdings_symbol_idx ON holdings(symbol);

CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_id UUID REFERENCES asset_tokens(id) ON DELETE CASCADE,
  series_id UUID REFERENCES asset_series(id) ON DELETE SET NULL,
  listing_type TEXT NOT NULL DEFAULT 'fixed_price',
  price NUMERIC(20, 6) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ANYU',
  status TEXT NOT NULL DEFAULT 'active',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS listings_status_created_at_idx ON listings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS listings_seller_user_id_idx ON listings(seller_user_id);

CREATE TABLE IF NOT EXISTS listing_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price NUMERIC(20, 6) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ANYU',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS listing_offers_listing_id_idx ON listing_offers(listing_id);
CREATE INDEX IF NOT EXISTS listing_offers_buyer_user_id_idx ON listing_offers(buyer_user_id);

CREATE TABLE IF NOT EXISTS airdrops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  project TEXT,
  reward_symbol TEXT NOT NULL DEFAULT 'ANYU',
  reward_amount NUMERIC(28, 8) NOT NULL DEFAULT 0,
  total_quota INTEGER,
  claimed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS airdrops_status_idx ON airdrops(status);

CREATE TABLE IF NOT EXISTS airdrop_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airdrop_id UUID NOT NULL REFERENCES airdrops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'claimed',
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(airdrop_id, user_id)
);

CREATE INDEX IF NOT EXISTS airdrop_claims_user_id_idx ON airdrop_claims(user_id);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  notif_type TEXT NOT NULL DEFAULT 'system',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS forum_posts_status_created_at_idx ON forum_posts(status, created_at DESC);

CREATE TABLE IF NOT EXISTS forum_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS forum_comments_post_id_created_at_idx ON forum_comments(post_id, created_at);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS messages_recipient_user_id_created_at_idx ON messages(recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_sender_user_id_created_at_idx ON messages(sender_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reward_amount NUMERIC(28, 8) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS referrals_referrer_user_id_idx ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS referrals_referral_code_idx ON referrals(referral_code);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_settings (key, value)
VALUES
  ('app_mode', '{"mode":"alpha","publicTesting":true,"realFundsEnabled":false}'::jsonb),
  ('risk_notice', '{"title":"Alpha 測試版","body":"目前開放註冊與介面流程測試，資產、價格、交易、KYC、錢包資料皆為測試展示。"}'::jsonb)
ON CONFLICT (key) DO NOTHING;
