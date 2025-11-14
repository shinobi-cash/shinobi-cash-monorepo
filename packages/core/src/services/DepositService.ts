/**
 * Deposit Service - Pure business logic
 *
 * Handles deposit commitment generation and index management.
 * Separated from UI/storage concerns for maximum reusability.
 */

import { deriveDepositNullifier, deriveDepositSecret } from '../crypto/noteDerivation.js';
import { poseidon2 } from 'poseidon-lite';
import type { IDepositStorageProvider } from '../interfaces/IDepositStorageProvider.js';
import type { DepositCommitmentResult, DepositCommitmentOptions } from '../types/Deposit.js';

/**
 * Service for managing deposits
 *
 * @example
 * ```typescript
 * // Create service with storage implementation
 * const depositService = new DepositService(storageProvider);
 *
 * // Generate commitment
 * const result = await depositService.generateDepositCommitment(
 *   accountKey,
 *   publicKey,
 *   poolAddress
 * );
 *
 * // After successful deposit transaction
 * await depositService.updateDepositIndex(
 *   publicKey,
 *   poolAddress,
 *   result.depositIndex
 * );
 * ```
 */
export class DepositService {
  constructor(private storageProvider: IDepositStorageProvider) {}

  /**
   * Generate deposit commitment
   *
   * Uses privacy-preserving local derivation to generate a commitment
   * that can be submitted in a deposit transaction.
   *
   * @param accountKey - User's account key (as bigint)
   * @param publicKey - User's public key/address
   * @param poolAddress - Pool contract address
   * @param options - Optional configuration
   * @returns Deposit commitment result with precommitment hash
   */
  async generateDepositCommitment(
    accountKey: bigint,
    publicKey: string,
    poolAddress: string,
    options?: DepositCommitmentOptions,
  ): Promise<DepositCommitmentResult> {
    // Get next deposit index from storage
    const depositIndex = options?.depositIndex ?? (await this.storageProvider.getNextDepositIndex(publicKey, poolAddress));

    // Derive nullifier and secret using account key
    const depositNullifier = deriveDepositNullifier(accountKey, poolAddress, depositIndex);
    const depositSecret = deriveDepositSecret(accountKey, poolAddress, depositIndex);

    // Calculate precommitment = Poseidon2([nullifier, secret])
    const precommitment = poseidon2([depositNullifier, depositSecret]);

    return {
      precommitment: `0x${precommitment.toString(16)}`,
      depositIndex,
      poolAddress,
      nullifier: depositNullifier,
      secret: depositSecret,
    };
  }

  /**
   * Update deposit index after successful deposit
   *
   * Call this after a deposit transaction has been confirmed to increment
   * the deposit index for the next deposit.
   *
   * @param publicKey - User's public key/address
   * @param poolAddress - Pool contract address
   * @param depositIndex - Deposit index that was just used
   */
  async updateDepositIndex(publicKey: string, poolAddress: string, depositIndex: number): Promise<void> {
    await this.storageProvider.updateLastUsedDepositIndex(publicKey, poolAddress, depositIndex);
  }
}
