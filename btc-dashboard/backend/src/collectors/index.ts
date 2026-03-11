/**
 * collectors/index.ts
 * Registry of all data collectors.
 * Each collector is responsible for:
 *   1. Fetching ALL historical data on first run
 *   2. Only fetching missing/new data on subsequent runs
 */

export * from './coinGecko';
export * from './blockchainInfo';
export * from './glassnode';
