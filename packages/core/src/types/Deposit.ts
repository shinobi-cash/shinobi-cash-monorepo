/**
 * Deposit Type Definitions
 *
 * Types for generating deposit commitments and managing deposit flow
 */

/**
 * Result of generating a deposit commitment
 */
export interface DepositCommitmentResult {
  /** The precommitment hash to include in the deposit transaction */
  precommitment: string;

  /** The deposit index used for this commitment */
  depositIndex: number;

  /** Pool address for this deposit */
  poolAddress: string;

  /** Nullifier derived for this deposit (for internal tracking) */
  nullifier: bigint;

  /** Secret derived for this deposit (for internal tracking) */
  secret: bigint;
}

/**
 * Options for generating a deposit commitment
 */
export interface DepositCommitmentOptions {
  /** Override the automatic deposit index selection */
  depositIndex?: number;

  /** Force regeneration even if a commitment already exists */
  forceRegenerate?: boolean;
}
