/**
 * Account Key Utilities
 *
 * Centralizes all account key resolution and parsing logic to ensure consistency
 * across cryptographic operations.
 */

import { restoreFromMnemonic, validateMnemonic } from './keyGeneration.js';
import { parseUserKey } from './noteDerivation.js';

/**
 * Authentication credentials (either mnemonic or private key)
 */
export interface AuthCredentials {
  /** Mnemonic phrase as array of words */
  mnemonic?: string[];

  /** Private key as hex string */
  privateKey?: string;
}

/**
 * Single source of truth for converting authentication credentials to account key.
 * Always returns a properly parsed bigint account key suitable for cryptographic operations.
 *
 * @param credentials - Either mnemonic (as string array) or private key
 * @returns Parsed account key as bigint, ready for crypto operations
 * @throws Error if no valid credentials provided
 *
 * @example
 * ```typescript
 * // From private key
 * const key1 = getAccountKey({ privateKey: "0x..." });
 *
 * // From mnemonic
 * const key2 = getAccountKey({ mnemonic: ["word1", "word2", ...] });
 * ```
 */
export function getAccountKey(credentials: AuthCredentials): bigint {
  // Prefer private key if available (more direct)
  if (credentials.privateKey) {
    return parseUserKey(credentials.privateKey);
  }

  // Fall back to mnemonic derivation
  if (credentials.mnemonic && credentials.mnemonic.length > 0) {
    const { privateKey } = restoreFromMnemonic(credentials.mnemonic);
    return parseUserKey(privateKey);
  }

  throw new Error('No valid authentication credentials available');
}

/**
 * Safely parses user input string into mnemonic word array
 *
 * @param input - Raw mnemonic string from user
 * @returns Validated mnemonic array
 * @throws Error if invalid format
 *
 * @example
 * ```typescript
 * const mnemonic = parseMnemonicInput("word1 word2 word3 ...");
 * ```
 */
export function parseMnemonicInput(input: string): string[] {
  const words = input.trim().split(/\s+/);

  if (!validateMnemonic(words)) {
    throw new Error(`Invalid mnemonic: expected 12 or 24 words, got ${words.length}`);
  }

  return words;
}

/**
 * Converts mnemonic array back to space-separated string for display/storage
 *
 * @param mnemonic - Mnemonic word array
 * @returns Space-separated string
 *
 * @example
 * ```typescript
 * const string = mnemonicToString(["word1", "word2", ...]);
 * // "word1 word2 ..."
 * ```
 */
export function mnemonicToString(mnemonic: string[]): string {
  return mnemonic.join(' ');
}
