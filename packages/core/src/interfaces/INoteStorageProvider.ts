/**
 * Note Storage Provider Interface
 *
 * Abstracts storage operations for note discovery and management.
 * Applications must implement this interface to provide storage capabilities.
 */

import type { DiscoveryResult, NoteChain } from '../types/index.js';

/**
 * Interface for note storage operations
 *
 * Applications implementing this interface can use any storage backend:
 * - Browser: IndexedDB, LocalStorage
 * - Server: Database (PostgreSQL, MongoDB, etc.)
 * - Mobile: SQLite, AsyncStorage
 */
export interface INoteStorageProvider {
  /**
   * Get cached notes for discovery resumption
   *
   * @param publicKey - User's public key
   * @param poolAddress - Pool contract address
   * @returns Cached discovery result or null if no cache exists
   */
  getCachedNotes(publicKey: string, poolAddress: string): Promise<DiscoveryResult | null>;

  /**
   * Store discovered notes with pagination cursor
   *
   * @param publicKey - User's public key
   * @param poolAddress - Pool contract address
   * @param notes - Discovered note chains
   * @param lastProcessedCursor - Pagination cursor for resumable discovery
   */
  storeDiscoveredNotes(
    publicKey: string,
    poolAddress: string,
    notes: NoteChain[],
    lastProcessedCursor?: string,
  ): Promise<void>;

  /**
   * Get next deposit index for new deposits
   *
   * @param publicKey - User's public key
   * @param poolAddress - Pool contract address
   * @returns Next available deposit index
   */
  getNextDepositIndex(publicKey: string, poolAddress: string): Promise<number>;

  /**
   * Update last used deposit index
   *
   * @param publicKey - User's public key
   * @param poolAddress - Pool contract address
   * @param depositIndex - Deposit index that was just used
   */
  updateLastUsedDepositIndex(publicKey: string, poolAddress: string, depositIndex: number): Promise<void>;
}
