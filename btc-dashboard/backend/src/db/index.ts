/**
 * db/index.ts
 * SQLite database setup for storing BTC metrics data.
 * All historical data is fetched once and stored here.
 * Daily updates only fetch incremental data.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'btc_metrics.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

/**
 * Initialize all database tables.
 * Run once at startup.
 */
export function initDatabase() {
  db.exec(`
    -- ================================================
    -- PRICE & MARKET DATA
    -- ================================================

    CREATE TABLE IF NOT EXISTS price_daily (
      date        TEXT PRIMARY KEY,   -- YYYY-MM-DD
      open        REAL,
      high        REAL,
      low         REAL,
      close       REAL,
      volume_usd  REAL,
      market_cap  REAL,
      source      TEXT,
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS btc_dominance_daily (
      date        TEXT PRIMARY KEY,
      dominance   REAL,               -- percentage 0-100
      source      TEXT,
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    -- ================================================
    -- ON-CHAIN DATA
    -- ================================================

    CREATE TABLE IF NOT EXISTS onchain_daily (
      date                      TEXT PRIMARY KEY,
      tx_count                  INTEGER,
      tx_volume_btc             REAL,
      tx_volume_usd             REAL,
      active_addresses          INTEGER,
      new_addresses             INTEGER,
      total_addresses           INTEGER,
      avg_fee_btc               REAL,
      avg_fee_usd               REAL,
      median_fee_sat_vbyte      REAL,
      block_count               INTEGER,
      avg_block_size_bytes      INTEGER,
      utxo_count                INTEGER,
      source                    TEXT,
      updated_at                TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS lightning_daily (
      date              TEXT PRIMARY KEY,
      node_count        INTEGER,
      channel_count     INTEGER,
      capacity_btc      REAL,
      avg_fee_rate      REAL,
      source            TEXT,
      updated_at        TEXT DEFAULT (datetime('now'))
    );

    -- ================================================
    -- MINING DATA
    -- ================================================

    CREATE TABLE IF NOT EXISTS mining_daily (
      date                  TEXT PRIMARY KEY,
      hashrate_eh           REAL,       -- EH/s
      difficulty            REAL,
      block_reward_btc      REAL,
      miner_revenue_usd     REAL,
      miner_revenue_btc     REAL,
      fees_revenue_pct      REAL,       -- % of revenue from fees
      source                TEXT,
      updated_at            TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pool_distribution (
      date      TEXT,
      pool_name TEXT,
      blocks    INTEGER,
      pct       REAL,
      source    TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (date, pool_name)
    );

    -- ================================================
    -- SUPPLY & HOLDER DATA
    -- ================================================

    CREATE TABLE IF NOT EXISTS supply_daily (
      date                  TEXT PRIMARY KEY,
      circulating_supply    REAL,
      realized_cap_usd      REAL,
      realized_price        REAL,
      lth_supply            REAL,       -- long-term holder supply
      sth_supply            REAL,       -- short-term holder supply
      illiquid_supply       REAL,
      liquid_supply         REAL,
      source                TEXT,
      updated_at            TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exchange_flows_daily (
      date              TEXT PRIMARY KEY,
      exchange_netflow  REAL,           -- BTC net inflow to exchanges (neg = outflow)
      exchange_balance  REAL,           -- total BTC on exchanges
      source            TEXT,
      updated_at        TEXT DEFAULT (datetime('now'))
    );

    -- ================================================
    -- COMPUTED INDICATORS
    -- These are calculated from raw data above
    -- ================================================

    CREATE TABLE IF NOT EXISTS indicators_daily (
      date                TEXT PRIMARY KEY,
      -- Valuation
      mvrv_ratio          REAL,         -- Market Cap / Realized Cap
      mvrv_zscore         REAL,
      nvt_ratio           REAL,         -- Market Cap / TX Volume
      nvt_signal          REAL,         -- Market Cap / 90d MA TX Volume
      realized_price      REAL,
      thermocap_multiple  REAL,
      puell_multiple      REAL,         -- Daily issuance USD / 365d MA issuance USD
      -- S2F
      s2f_ratio           REAL,
      s2f_model_price     REAL,
      -- Risk
      reserve_risk        REAL,
      rhodl_ratio         REAL,
      updated_at          TEXT DEFAULT (datetime('now'))
    );

    -- ================================================
    -- METADATA
    -- ================================================

    CREATE TABLE IF NOT EXISTS sync_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      metric        TEXT NOT NULL,
      last_date     TEXT,
      last_run      TEXT DEFAULT (datetime('now')),
      status        TEXT,               -- 'success' | 'error'
      message       TEXT,
      records_added INTEGER
    );

    CREATE TABLE IF NOT EXISTS halvings (
      id            INTEGER PRIMARY KEY,
      block_height  INTEGER,
      date          TEXT,
      reward_before REAL,
      reward_after  REAL
    );

    -- Seed halving data (static)
    INSERT OR IGNORE INTO halvings VALUES
      (1, 210000,  '2012-11-28', 50.0,    25.0),
      (2, 420000,  '2016-07-09', 25.0,    12.5),
      (3, 630000,  '2020-05-11', 12.5,     6.25),
      (4, 840000,  '2024-04-19',  6.25,    3.125);
  `);

  console.log('✅ Database initialized at', DB_PATH);
}

export default db;
