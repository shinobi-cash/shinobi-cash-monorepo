/**
 * Withdrawal Context Service
 *
 * Utilities for calculating withdrawal context and deriving nullifiers/secrets.
 * Pure business logic separated from contract interactions.
 */

import {
  deriveChangeNullifier,
  deriveChangeSecret,
  deriveDepositNullifier,
  deriveDepositSecret,
  derivedNoteCommitment,
  deriveRefundNullifier,
  deriveRefundSecret,
} from '../crypto/noteDerivation.js';
import type { Note } from '../types/Note.js';
import { encodeAbiParameters, keccak256 } from 'viem';

/**
 * BN254 scalar field modulus for ZK-SNARK circuits
 */
export const SNARK_SCALAR_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/**
 * Withdrawal context data
 */
export interface WithdrawalContext {
  /** Context hash for proof */
  context: bigint;

  /** New nullifier for change note */
  newNullifier: bigint;

  /** New secret for change note */
  newSecret: bigint;

  /** Existing nullifier being spent */
  existingNullifier: bigint;

  /** Existing secret being spent */
  existingSecret: bigint;

  /** Commitment of the note being spent */
  existingCommitment: bigint;
}

/**
 * Cross-chain withdrawal context data
 */
export interface CrosschainWithdrawalContext extends WithdrawalContext {
  /** Refund nullifier for failed withdrawal */
  refundNullifier: bigint;

  /** Refund secret for failed withdrawal */
  refundSecret: bigint;

  /** Refund commitment hash */
  refundCommitment: bigint;
}

/**
 * Hash data to BigInt using keccak256 and mod scalar field
 *
 * @param data - Hex string to hash
 * @returns BigInt modulo SNARK scalar field
 */
export function hashToBigInt(data: string): bigint {
  const hash = keccak256(data as `0x${string}`);
  return BigInt(hash) % SNARK_SCALAR_FIELD;
}

/**
 * Calculate withdrawal context hash
 *
 * Computes the context hash used in ZK proofs by encoding withdrawal data
 * and pool scope, then hashing and reducing modulo the SNARK scalar field.
 *
 * @param withdrawalData - Tuple of [processooor address, encoded data]
 * @param poolScope - Pool scope identifier
 * @returns Context hash as BigInt
 *
 * @example
 * ```typescript
 * const context = calculateContextHash(
 *   ["0x...", "0x..."], // [entrypoint, encodedParams]
 *   12345n
 * );
 * ```
 */
export function calculateContextHash(withdrawalData: readonly [string, string], poolScope: bigint): bigint {
  const encoded = encodeAbiParameters(
    [{ type: 'tuple', components: [{ type: 'address' }, { type: 'bytes' }] }, { type: 'uint256' }],
    [withdrawalData as readonly [`0x${string}`, `0x${string}`], poolScope],
  );
  return hashToBigInt(encoded);
}

/**
 * Calculate same-chain withdrawal context
 *
 * Derives all necessary nullifiers, secrets, and context hash for a withdrawal.
 *
 * @param note - Note being spent
 * @param accountKey - Account key for derivation
 * @param withdrawalData - Withdrawal data tuple
 * @param poolScope - Pool scope identifier
 * @returns Complete withdrawal context
 *
 * @example
 * ```typescript
 * const context = calculateWithdrawalContext(
 *   note,
 *   accountKey,
 *   ["0x...", "0x..."],
 *   12345n
 * );
 *
 * // Use context in proof generation
 * const proof = await proofGenerator.generateWithdrawalProof({
 *   existingCommitmentHash: context.existingCommitment,
 *   existingNullifier: context.existingNullifier,
 *   existingSecret: context.existingSecret,
 *   newNullifier: context.newNullifier,
 *   newSecret: context.newSecret,
 *   context: context.context,
 *   ...
 * });
 * ```
 */
export function calculateWithdrawalContext(
  note: Note,
  accountKey: bigint,
  withdrawalData: readonly [string, string],
  poolScope: bigint,
): WithdrawalContext {
  // Calculate context hash
  const context = calculateContextHash(withdrawalData, poolScope);

  // Calculate existing commitment
  const existingCommitment = derivedNoteCommitment(accountKey, note);

  // Generate new nullifier and secret for the change note
  const newNullifier = deriveChangeNullifier(accountKey, note.poolAddress, note.depositIndex, note.changeIndex + 1);
  const newSecret = deriveChangeSecret(accountKey, note.poolAddress, note.depositIndex, note.changeIndex + 1);

  // Get existing nullifier and secret from the note being spent
  let existingNullifier: bigint;
  let existingSecret: bigint;

  if (note.changeIndex === 0) {
    // Deposit note
    existingNullifier = deriveDepositNullifier(accountKey, note.poolAddress, note.depositIndex);
    existingSecret = deriveDepositSecret(accountKey, note.poolAddress, note.depositIndex);
  } else {
    // Change note
    existingNullifier = deriveChangeNullifier(accountKey, note.poolAddress, note.depositIndex, note.changeIndex);
    existingSecret = deriveChangeSecret(accountKey, note.poolAddress, note.depositIndex, note.changeIndex);
  }

  return {
    context,
    newNullifier,
    newSecret,
    existingNullifier,
    existingSecret,
    existingCommitment,
  };
}

/**
 * Calculate cross-chain withdrawal context
 *
 * Derives all necessary nullifiers, secrets, refund values, and context hash
 * for a cross-chain withdrawal.
 *
 * @param note - Note being spent
 * @param accountKey - Account key for derivation
 * @param withdrawalData - Withdrawal data tuple
 * @param poolScope - Pool scope identifier
 * @returns Complete cross-chain withdrawal context
 *
 * @example
 * ```typescript
 * const context = calculateCrosschainWithdrawalContext(
 *   note,
 *   accountKey,
 *   ["0x...", "0x..."],
 *   12345n
 * );
 *
 * // Use context in cross-chain proof generation
 * const proof = await proofGenerator.generateCrosschainWithdrawalProof({
 *   existingCommitmentHash: context.existingCommitment,
 *   existingNullifier: context.existingNullifier,
 *   existingSecret: context.existingSecret,
 *   newNullifier: context.newNullifier,
 *   newSecret: context.newSecret,
 *   refundNullifier: context.refundNullifier,
 *   refundSecret: context.refundSecret,
 *   context: context.context,
 *   ...
 * });
 * ```
 */
export function calculateCrosschainWithdrawalContext(
  note: Note,
  accountKey: bigint,
  withdrawalData: readonly [string, string],
  poolScope: bigint,
): CrosschainWithdrawalContext {
  // Get base context (same as same-chain)
  const baseContext = calculateWithdrawalContext(note, accountKey, withdrawalData, poolScope);

  // Derive refund nullifier and secret
  const refundNullifier = deriveRefundNullifier(
    accountKey,
    note.poolAddress,
    note.depositIndex,
    note.changeIndex + 1,
  );
  const refundSecret = deriveRefundSecret(accountKey, note.poolAddress, note.depositIndex, note.changeIndex + 1);

  // Calculate refund commitment (for proof verification)
  const { poseidon2, poseidon3 } = require('poseidon-lite');
  const refundPrecommitment = poseidon2([refundNullifier, refundSecret]);
  const remainingAmount = BigInt(note.amount); // Refund gets remaining amount
  const refundCommitment = poseidon3([remainingAmount, BigInt(note.label), refundPrecommitment]);

  return {
    ...baseContext,
    refundNullifier,
    refundSecret,
    refundCommitment,
  };
}
