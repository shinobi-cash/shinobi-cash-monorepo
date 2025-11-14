/**
 * Note Type Definitions
 *
 * Notes represent privacy pool commitments that can be deposited, withdrawn, or changed.
 * Each note contains cryptographic commitments and metadata for ZK proof generation.
 */

/**
 * A note representing a commitment in the privacy pool
 */
export interface Note {
  /** Pool contract address */
  poolAddress: string;

  /** Sequential deposit index for this account in this pool */
  depositIndex: number;

  /** Sequential change index within this deposit chain */
  changeIndex: number;

  /** Refund index for failed cross-chain withdrawals */
  refundIndex?: number;

  /** Type of note (deposit, change from withdrawal, or refund) */
  noteType: 'deposit' | 'change' | 'refund';

  /** Note amount in wei (as string for BigInt compatibility) */
  amount: string;

  /** Transaction hash on the origin chain */
  originTransactionHash: string;

  /** Transaction hash on the destination chain (same as origin for same-chain) */
  destinationTransactionHash: string;

  /** Chain ID where the note originated */
  originChainId: string;

  /** Chain ID where the note is/will be settled */
  destinationChainId: string;

  /** Block number where note was created */
  blockNumber: string;

  /** Timestamp of note creation */
  timestamp: string;

  /** Spending status of the note */
  status: 'unspent' | 'spent';

  /** Whether the note has been activated in the pool (labeled by solver) */
  isActivated: boolean;

  /** Label assigned by solver (keccak256 hash) */
  label: string;

  /** Refund commitment for cross-chain failures */
  refundCommitment?: string;
}

/**
 * A chain of notes representing the complete history of a deposit
 * Starting with an initial deposit, followed by change notes from withdrawals
 */
export type NoteChain = Note[];

/**
 * Cached note data stored locally with discovery metadata
 */
export interface CachedNoteData {
  /** Pool contract address */
  poolAddress: string;

  /** User's public key/address */
  publicKey: string;

  /** All discovered note chains for this account */
  notes: NoteChain[];

  /** Last used deposit index (for generating new deposits) */
  lastUsedDepositIndex: number;

  /** Timestamp of last sync/discovery */
  lastSyncTime: number;

  /** Cursor for resumable discovery pagination */
  lastProcessedCursor?: string;
}
