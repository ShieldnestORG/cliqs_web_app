CREATE SCHEMA IF NOT EXISTS multisig_indexer;

CREATE TABLE IF NOT EXISTS multisig_indexer.multisigs (
  id BIGSERIAL PRIMARY KEY,
  chain_id TEXT NOT NULL,
  multisig_address TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'native_amino',
  threshold INTEGER,
  pubkey_fingerprint TEXT,
  raw_multisig_pubkey JSONB,
  label TEXT,
  description TEXT,
  creator TEXT,
  source_first_seen TEXT NOT NULL,
  first_seen_height BIGINT,
  last_seen_height BIGINT,
  last_seen_tx_hash TEXT,
  verification_status TEXT NOT NULL DEFAULT 'inferred',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chain_id, multisig_address)
);

CREATE TABLE IF NOT EXISTS multisig_indexer.multisig_members (
  id BIGSERIAL PRIMARY KEY,
  chain_id TEXT NOT NULL,
  multisig_address TEXT NOT NULL,
  member_address TEXT,
  member_pubkey_fingerprint TEXT,
  raw_member_pubkey JSONB,
  weight INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'inferred',
  first_seen_height BIGINT,
  last_seen_height BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS multisig_members_chain_multisig_position_idx
  ON multisig_indexer.multisig_members (chain_id, multisig_address, position);

CREATE INDEX IF NOT EXISTS multisig_members_chain_member_address_idx
  ON multisig_indexer.multisig_members (chain_id, member_address);

CREATE INDEX IF NOT EXISTS multisig_members_chain_member_pubkey_idx
  ON multisig_indexer.multisig_members (chain_id, member_pubkey_fingerprint);

CREATE INDEX IF NOT EXISTS multisig_members_chain_multisig_idx
  ON multisig_indexer.multisig_members (chain_id, multisig_address);

CREATE TABLE IF NOT EXISTS multisig_indexer.multisig_discovery_events (
  id BIGSERIAL PRIMARY KEY,
  chain_id TEXT NOT NULL,
  multisig_address TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  tx_hash TEXT,
  height BIGINT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS multisig_discovery_events_chain_multisig_idx
  ON multisig_indexer.multisig_discovery_events (chain_id, multisig_address, created_at DESC);

CREATE TABLE IF NOT EXISTS multisig_indexer.indexer_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
