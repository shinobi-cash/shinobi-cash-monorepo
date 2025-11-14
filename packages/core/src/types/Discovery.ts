/**
 * Note Discovery Type Definitions
 *
 * Types for the note discovery process that scans indexed blockchain data
 * to find notes belonging to a user's account.
 */

import type { NoteChain } from './Note.js';

/**
 * Result of a note discovery operation
 */
export interface DiscoveryResult {
  /** Discovered note chains */
  notes: NoteChain[];

  /** Last used deposit index (for generating next deposit) */
  lastUsedIndex: number;

  /** Number of new notes found in this discovery session */
  newNotesFound: number;

  /** Pagination cursor for resuming discovery */
  lastProcessedCursor?: string;
}

/**
 * Progress information during note discovery
 * Used for UI feedback during potentially long-running scans
 */
export interface DiscoveryProgress {
  /** Number of activity pages processed */
  pagesProcessed: number;

  /** Number of activities in the current page */
  currentPageActivityCount: number;

  /** Number of deposit indices checked */
  depositsChecked: number;

  /** Number of deposits matched to this account */
  depositsMatched: number;

  /** Last pagination cursor processed */
  lastCursor?: string;

  /** Whether the discovery scan is complete */
  complete: boolean;
}

/**
 * Options for note discovery
 */
export interface DiscoveryOptions {
  /** Abort signal for canceling long-running discovery */
  signal?: AbortSignal;

  /** Progress callback for UI updates */
  onProgress?: (progress: DiscoveryProgress) => void;

  /** Maximum number of pages to scan (default: unlimited) */
  maxPages?: number;

  /** Page size for activity queries (default: 100) */
  pageSize?: number;
}
