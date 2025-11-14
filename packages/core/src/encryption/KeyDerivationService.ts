/**
 * Key Derivation Service
 *
 * Provides cryptographic key derivation functions using PBKDF2 and HKDF.
 * Uses Web Crypto API (available in browsers and Node.js 15+).
 */

// Configuration constants
const CONFIG = {
  PBKDF2_ITERATIONS: 310_000, // OWASP 2023 recommendation
  KEY_LENGTH: 256,
  HASH_ALGORITHM: 'SHA-256',
  SALT_PREFIX: 'shinobi-salt-',
  HKDF_INFO: new TextEncoder().encode('shinobi-kdf-v1'),
} as const;

/**
 * Result of key derivation
 */
export interface DerivedKeyResult {
  /** Derived symmetric key for AES-GCM encryption */
  symmetricKey: CryptoKey;

  /** Salt used for derivation */
  salt: Uint8Array;
}

/**
 * Key Derivation Service
 *
 * Provides secure key derivation from passwords and other sources.
 *
 * @example
 * ```typescript
 * const kdf = new KeyDerivationService();
 *
 * // Derive key from password
 * const result = await kdf.deriveKeyFromPassword("password123", "user@example.com");
 *
 * // Use key for encryption
 * encryptionService.setEncryptionKey(result.symmetricKey);
 * ```
 */
export class KeyDerivationService {
  /**
   * Generate deterministic salt from account identifier
   *
   * Creates a deterministic salt based on the account name, which allows
   * the same user to derive the same key across sessions.
   *
   * @param accountName - Account identifier
   * @returns Deterministic salt
   */
  async generateAccountSalt(accountName: string): Promise<Uint8Array> {
    const saltInput = CONFIG.SALT_PREFIX + accountName.toLowerCase().trim();
    const hash = await crypto.subtle.digest(CONFIG.HASH_ALGORITHM, new TextEncoder().encode(saltInput));
    return new Uint8Array(hash);
  }

  /**
   * Build hybrid salt combining account salt and user salt
   *
   * @param accountSalt - Deterministic account salt
   * @param userSalt - Random user-specific salt
   * @returns Combined salt
   */
  buildHybridSalt(accountSalt: Uint8Array, userSalt: Uint8Array): Uint8Array {
    const out = new Uint8Array(accountSalt.length + userSalt.length);
    out.set(accountSalt, 0);
    out.set(userSalt, accountSalt.length);
    return out;
  }

  /**
   * Derive key from password using PBKDF2
   *
   * Uses 310,000 iterations as recommended by OWASP 2023 for SHA-256.
   *
   * @param password - User password
   * @param salt - Salt for key derivation
   * @returns Derived key and salt
   *
   * @example
   * ```typescript
   * const accountSalt = await kdf.generateAccountSalt("user@example.com");
   * const userSalt = crypto.getRandomValues(new Uint8Array(32));
   * const salt = kdf.buildHybridSalt(accountSalt, userSalt);
   *
   * const result = await kdf.deriveKeyFromPassword("password123", salt);
   * ```
   */
  async deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<DerivedKeyResult> {
    const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
      'deriveKey',
    ]);

    const symmetricKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: CONFIG.PBKDF2_ITERATIONS,
        hash: CONFIG.HASH_ALGORITHM,
      },
      keyMaterial,
      { name: 'AES-GCM', length: CONFIG.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt'],
    );

    return { symmetricKey, salt };
  }

  /**
   * Derive key from password with account name (convenience method)
   *
   * Automatically generates account salt and combines with user salt.
   *
   * @param password - User password
   * @param accountName - Account identifier
   * @param userSalt - Random user-specific salt (32 bytes recommended)
   * @returns Derived key and combined salt
   *
   * @example
   * ```typescript
   * const userSalt = crypto.getRandomValues(new Uint8Array(32));
   * const result = await kdf.deriveKeyFromPasswordWithAccount(
   *   "password123",
   *   "user@example.com",
   *   userSalt
   * );
   * ```
   */
  async deriveKeyFromPasswordWithAccount(
    password: string,
    accountName: string,
    userSalt: Uint8Array,
  ): Promise<DerivedKeyResult> {
    const accountSalt = await this.generateAccountSalt(accountName);
    const salt = this.buildHybridSalt(accountSalt, userSalt);
    return this.deriveKeyFromPassword(password, salt);
  }

  /**
   * Derive key from PRF bytes using HKDF
   *
   * Uses HKDF (HMAC-based Key Derivation Function) to derive a key from
   * PRF output (e.g., from WebAuthn passkey).
   *
   * @param prfBytes - PRF output bytes (typically 32 bytes)
   * @param salt - Salt for HKDF
   * @param info - Optional context info
   * @returns Derived key
   *
   * @example
   * ```typescript
   * const prfBytes = new Uint8Array(32); // From passkey PRF extension
   * const salt = await kdf.generateAccountSalt("user@example.com");
   *
   * const result = await kdf.deriveKeyFromPRF(prfBytes, salt);
   * ```
   */
  async deriveKeyFromPRF(prfBytes: Uint8Array, salt: Uint8Array, info?: Uint8Array): Promise<DerivedKeyResult> {
    const keyMaterial = await crypto.subtle.importKey('raw', prfBytes as BufferSource, 'HKDF', false, ['deriveKey']);

    const symmetricKey = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        salt: salt as BufferSource,
        info: (info || CONFIG.HKDF_INFO) as BufferSource,
        hash: CONFIG.HASH_ALGORITHM,
      },
      keyMaterial,
      { name: 'AES-GCM', length: CONFIG.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt'],
    );

    return { symmetricKey, salt };
  }

  /**
   * Generate random user salt
   *
   * @param length - Salt length in bytes (default: 32)
   * @returns Random salt
   */
  generateUserSalt(length: number = 32): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(length));
  }
}

/**
 * Export singleton instance for convenient usage
 */
export const keyDerivationService = new KeyDerivationService();

/**
 * Export public API for convenience
 */
export const KDF = {
  deriveKeyFromPassword: keyDerivationService.deriveKeyFromPassword.bind(keyDerivationService),
  deriveKeyFromPasswordWithAccount: keyDerivationService.deriveKeyFromPasswordWithAccount.bind(
    keyDerivationService,
  ),
  deriveKeyFromPRF: keyDerivationService.deriveKeyFromPRF.bind(keyDerivationService),
  generateAccountSalt: keyDerivationService.generateAccountSalt.bind(keyDerivationService),
  generateUserSalt: keyDerivationService.generateUserSalt.bind(keyDerivationService),
  buildHybridSalt: keyDerivationService.buildHybridSalt.bind(keyDerivationService),
};
