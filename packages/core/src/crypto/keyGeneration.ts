/**
 * Key Generation Utilities
 *
 * Handles mnemonic generation and HD wallet derivation
 */

import * as bip39 from 'bip39';
import { ethers } from 'ethers';

/**
 * Result of key generation from mnemonic
 */
export interface KeyGenerationResult {
  /** Uncompressed public key */
  publicKey: string;

  /** Private key (hex string) */
  privateKey: string;

  /** Mnemonic phrase as array of words */
  mnemonic: string[];

  /** Ethereum address */
  address: string;
}

/**
 * Generate keys from random seed (for deterministic generation)
 *
 * @param randomSeed - Random seed as hex string
 * @returns Generated keys and mnemonic
 */
export function generateKeysFromRandomSeed(randomSeed: string): KeyGenerationResult {
  // Use random seed as entropy for deterministic generation
  const seedBytes = hexToBytes(randomSeed);

  // Use 16 bytes for 12-word mnemonic generation (128 bits)
  let entropy: Uint8Array;

  if (seedBytes.length >= 16) {
    entropy = seedBytes.slice(0, 16);
  } else {
    // Pad if needed (shouldn't happen with 32-byte random seed)
    entropy = new Uint8Array(16);
    entropy.set(seedBytes, 0);

    for (let i = seedBytes.length; i < 16; i++) {
      entropy[i] = seedBytes[i % seedBytes.length]! ^ (i % 256);
    }
  }

  // Generate mnemonic from random entropy
  const mnemonic = bip39.entropyToMnemonic(Buffer.from(entropy));

  // Validate the mnemonic
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('Generated invalid mnemonic phrase');
  }

  // Generate HD wallet from mnemonic
  const wallet = ethers.Wallet.fromPhrase(mnemonic);

  return {
    publicKey: wallet.publicKey,
    privateKey: wallet.privateKey,
    mnemonic: mnemonic.split(' '),
    address: wallet.address,
  };
}

/**
 * Validate mnemonic phrase
 *
 * @param mnemonic - Mnemonic as array of words
 * @returns true if valid BIP39 mnemonic
 */
export function validateMnemonic(mnemonic: string[]): boolean {
  return bip39.validateMnemonic(mnemonic.join(' '));
}

/**
 * Restore wallet from mnemonic
 *
 * @param mnemonic - Mnemonic as array of words
 * @returns Restored keys
 * @throws Error if invalid mnemonic
 */
export function restoreFromMnemonic(mnemonic: string[]): KeyGenerationResult {
  const mnemonicPhrase = mnemonic.join(' ');

  if (!bip39.validateMnemonic(mnemonicPhrase)) {
    throw new Error('Invalid mnemonic phrase');
  }

  const wallet = ethers.Wallet.fromPhrase(mnemonicPhrase);

  return {
    publicKey: wallet.publicKey,
    privateKey: wallet.privateKey,
    mnemonic,
    address: wallet.address,
  };
}

/**
 * Generate a new random mnemonic
 *
 * @param wordCount - Number of words (12 or 24)
 * @returns Generated mnemonic as array
 */
export function generateMnemonic(wordCount: 12 | 24 = 12): string[] {
  const strength = wordCount === 12 ? 128 : 256;
  const mnemonic = bip39.generateMnemonic(strength);
  return mnemonic.split(' ');
}

// Helper functions
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}
