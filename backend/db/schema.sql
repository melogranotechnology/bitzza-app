-- Importi in unità minime (100 = 1.00 BITZ), sempre interi.
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Un conto per utente e conti di sistema (es. 'treasury').
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES users(id),
  system_code text UNIQUE,
  balance_minor bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((user_id IS NULL) <> (system_code IS NULL)),
  -- I conti utente non possono andare in negativo; quelli di sistema sì (emissione).
  CHECK (user_id IS NULL OR balance_minor >= 0)
);

CREATE TABLE IF NOT EXISTS ledger_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  memo text NOT NULL DEFAULT '',
  initiated_by uuid REFERENCES users(id),
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (initiated_by, idempotency_key)
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id bigserial PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES ledger_transactions(id),
  account_id uuid NOT NULL REFERENCES accounts(id),
  amount_minor bigint NOT NULL CHECK (amount_minor <> 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_entries_account_idx ON ledger_entries(account_id, id DESC);
CREATE INDEX IF NOT EXISTS ledger_entries_txn_idx ON ledger_entries(transaction_id);

-- Le voci del registro non si modificano né si cancellano.
CREATE OR REPLACE FUNCTION ledger_entries_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries è append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_entries_no_update ON ledger_entries;
CREATE TRIGGER ledger_entries_no_update BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_immutable();

-- Ogni transazione deve sommare a zero (doppia scrittura), verificato al commit.
CREATE OR REPLACE FUNCTION ledger_txn_balanced() RETURNS trigger AS $$
DECLARE total bigint;
BEGIN
  SELECT COALESCE(SUM(amount_minor), 0) INTO total FROM ledger_entries WHERE transaction_id = NEW.transaction_id;
  IF total <> 0 THEN
    RAISE EXCEPTION 'transazione % non bilanciata (somma %)', NEW.transaction_id, total;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_entries_balanced ON ledger_entries;
CREATE CONSTRAINT TRIGGER ledger_entries_balanced AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ledger_txn_balanced();

INSERT INTO accounts (system_code) VALUES ('treasury') ON CONFLICT (system_code) DO NOTHING;

-- Compatibilità con le app esistenti (web e iOS).
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_address text;
UPDATE users SET wallet_address = '0x' || substr(md5(id::text) || md5(id::text || 'bitzza'), 1, 40) WHERE wallet_address IS NULL;
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS address_book (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  label text NOT NULL,
  address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, address)
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  theme text NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
  notifications_enabled integer NOT NULL DEFAULT 1,
  privacy_mode integer NOT NULL DEFAULT 0,
  default_slippage numeric NOT NULL DEFAULT 0.5 CHECK (default_slippage BETWEEN 0 AND 50),
  updated_at timestamptz NOT NULL DEFAULT now()
);
