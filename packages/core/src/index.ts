/**
 * Shinobi Cash Core SDK
 *
 * Framework-agnostic SDK for privacy pool operations including:
 * - Cryptographic primitives (note derivation, commitments)
 * - Note discovery and management
 * - Zero-knowledge proof generation
 * - Deposit and withdrawal flows
 */

// ============================================
// TYPES
// ============================================

export type {
  // Note types
  Note,
  NoteChain,
  CachedNoteData,
  // Discovery types
  DiscoveryResult,
  DiscoveryProgress,
  DiscoveryOptions,
  // Deposit types
  DepositCommitmentResult,
  DepositCommitmentOptions,
  // Withdrawal types
  WithdrawalRequest,
  WithdrawalContext,
  CrosschainWithdrawalContext,
  WithdrawalProofData,
  StateTreeLeaf,
  ASPData,
  PreparedWithdrawal,
} from './types/index.js';

// ============================================
// CRYPTOGRAPHY
// ============================================

export {
  // Note derivation
  parseUserKey,
  deriveDepositNullifier,
  deriveDepositSecret,
  deriveChangeNullifier,
  deriveChangeSecret,
  deriveRefundNullifier,
  deriveRefundSecret,
  derivedNoteCommitment,
  // Key generation
  generateKeysFromRandomSeed,
  validateMnemonic,
  restoreFromMnemonic,
  generateMnemonic,
  // Account key utilities
  getAccountKey,
  parseMnemonicInput,
  mnemonicToString,
  // Types
  type KeyGenerationResult,
  type AuthCredentials,
} from './crypto/index.js';

// ============================================
// ZERO-KNOWLEDGE PROOFS
// ============================================

export {
  WithdrawalProofGenerator,
  type CircuitFiles,
  type CircuitFileLoader,
  type WithdrawalProofArgs,
  type CrosschainWithdrawalProofArgs,
} from './zk/index.js';

// ============================================
// SERVICES
// ============================================

export {
  DepositService,
  NoteDiscoveryService,
  calculateContextHash,
  calculateWithdrawalContext,
  calculateCrosschainWithdrawalContext,
  hashToBigInt,
  SNARK_SCALAR_FIELD,
  type ActivityFetcher,
} from './services/index.js';

// ============================================
// ENCRYPTION & KEY DERIVATION
// ============================================

export {
  EncryptionService,
  KeyDerivationService,
  keyDerivationService,
  KDF,
  type EncryptedData,
  type DerivedKeyResult,
} from './encryption/index.js';

// ============================================
// INTERFACES
// ============================================

export type {
  INoteStorageProvider,
  IDepositStorageProvider,
} from './interfaces/index.js';
