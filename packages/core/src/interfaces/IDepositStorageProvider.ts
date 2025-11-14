/**
 * Deposit Storage Provider Interface
 *
 * Abstracts storage operations for deposit service.
 * Applications must implement this interface to track deposit indices.
 */

/**
 * Interface for deposit storage operations
 *
 * This is a simpler interface focused specifically on deposit index management.
 * Applications can reuse their INoteStorageProvider implementation or create
 * a separate lightweight implementation.
 */
export interface IDepositStorageProvider {
  /**
   * Get next deposit index for new deposits
   *
   * @param publicKey - User's public key
   * @param poolAddress - Pool contract address
   * @returns Next available deposit index
   */
  getNextDepositIndex(publicKey: string, poolAddress: string): Promise<number>;

  /**
   * Update last used deposit index after successful deposit
   *
   * @param publicKey - User's public key
   * @param poolAddress - Pool contract address
   * @param depositIndex - Deposit index that was just used
   */
  updateLastUsedDepositIndex(publicKey: string, poolAddress: string, depositIndex: number): Promise<void>;
}
