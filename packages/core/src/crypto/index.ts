/**
 * Cryptographic Utilities
 */

// Note derivation
export {
  parseUserKey,
  deriveDepositNullifier,
  deriveDepositSecret,
  deriveChangeNullifier,
  deriveChangeSecret,
  deriveRefundNullifier,
  deriveRefundSecret,
  derivedNoteCommitment,
} from './noteDerivation.js';

// Key generation
export {
  generateKeysFromRandomSeed,
  validateMnemonic,
  restoreFromMnemonic,
  generateMnemonic,
  type KeyGenerationResult,
} from './keyGeneration.js';

// Account key utilities
export {
  getAccountKey,
  parseMnemonicInput,
  mnemonicToString,
  type AuthCredentials,
} from './accountKey.js';
