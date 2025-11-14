/**
 * Withdrawal Proof Generator for Privacy Pool
 *
 * This module provides utilities for generating zero-knowledge proofs
 * for Privacy Pool withdrawal operations using snarkjs and circuit files.
 *
 * Features:
 * - ZK proof generation using withdrawal circuits
 * - Merkle tree construction for state and ASP trees
 * - Proof verification using verification keys
 * - Environment-agnostic circuit file loading
 */

import { LeanIMT, type LeanIMTMerkleProof } from '@zk-kit/lean-imt';
import { poseidon2 } from 'poseidon-lite';
// @ts-ignore - snarkjs doesn't have type declarations
import * as snarkjs from 'snarkjs';

// ============ TYPES ============

/**
 * Withdrawal proof data in Groth16 format
 */
export interface WithdrawalProofData {
  /** Groth16 proof */
  proof: snarkjs.Groth16Proof;

  /** Public signals for verification */
  publicSignals: string[];
}

/**
 * Circuit files needed for proof generation
 */
export interface CircuitFiles {
  /** WASM circuit file */
  wasmFile: Uint8Array;

  /** Proving key file */
  zkeyFile: Uint8Array;

  /** Verification key data */
  vkeyData: object;
}

/**
 * Circuit file loader function type
 */
export type CircuitFileLoader = () => Promise<CircuitFiles>;

/**
 * Arguments for same-chain withdrawal proof
 */
export interface WithdrawalProofArgs {
  /** Existing commitment hash being spent */
  existingCommitmentHash: bigint;

  /** Value of existing note */
  existingValue: bigint;

  /** Nullifier of existing note */
  existingNullifier: bigint;

  /** Secret of existing note */
  existingSecret: bigint;

  /** Amount to withdraw */
  withdrawalValue: bigint;

  /** Context hash for withdrawal */
  context: bigint;

  /** Label of the note */
  label: bigint;

  /** Nullifier for change note */
  newNullifier: bigint;

  /** Secret for change note */
  newSecret: bigint;

  /** All commitments in state tree */
  stateTreeCommitments: bigint[];

  /** All approved labels in ASP tree */
  aspTreeLabels: bigint[];
}

/**
 * Arguments for cross-chain withdrawal proof
 */
export interface CrosschainWithdrawalProofArgs extends WithdrawalProofArgs {
  /** Nullifier for refund note */
  refundNullifier: bigint;

  /** Secret for refund note */
  refundSecret: bigint;
}

// ============ CONFIGURATION ============

const MAX_TREE_DEPTH = 32;

// ============ UTILITY FUNCTIONS ============

function padArray(arr: bigint[], length: number): bigint[] {
  if (arr.length >= length) return arr;
  return [...arr, ...Array(length - arr.length).fill(BigInt(0))];
}

// ============ WITHDRAWAL PROOF GENERATOR ============

/**
 * Withdrawal Proof Generator
 *
 * Handles ZK proof generation for privacy pool withdrawals.
 * Supports both same-chain and cross-chain withdrawal proofs.
 *
 * @example
 * ```typescript
 * // Create generator with custom circuit loader
 * const generator = new WithdrawalProofGenerator(async () => ({
 *   wasmFile: await loadWasm(),
 *   zkeyFile: await loadZkey(),
 *   vkeyData: await loadVkey()
 * }));
 *
 * // Generate proof
 * const proof = await generator.generateWithdrawalProof({
 *   existingCommitmentHash,
 *   existingValue,
 *   existingNullifier,
 *   existingSecret,
 *   withdrawalValue,
 *   context,
 *   label,
 *   newNullifier,
 *   newSecret,
 *   stateTreeCommitments,
 *   aspTreeLabels
 * });
 * ```
 */
export class WithdrawalProofGenerator {
  private circuitFiles: CircuitFiles | null = null;
  private crosschainCircuitFiles: CircuitFiles | null = null;
  private hash: (a: bigint, b: bigint) => bigint;
  private circuitFileLoader?: CircuitFileLoader;
  private crosschainCircuitFileLoader?: CircuitFileLoader;

  /**
   * Create a new proof generator
   *
   * @param circuitFileLoader - Function to load same-chain circuit files
   * @param crosschainCircuitFileLoader - Function to load cross-chain circuit files (optional)
   */
  constructor(circuitFileLoader?: CircuitFileLoader, crosschainCircuitFileLoader?: CircuitFileLoader) {
    this.hash = (a: bigint, b: bigint) => poseidon2([a, b]);
    this.circuitFileLoader = circuitFileLoader;
    this.crosschainCircuitFileLoader = crosschainCircuitFileLoader;
  }

  private async ensureCircuitFiles(): Promise<CircuitFiles> {
    if (!this.circuitFiles) {
      if (!this.circuitFileLoader) {
        throw new Error('Circuit file loader not provided. Please provide a circuit file loader in constructor.');
      }
      this.circuitFiles = await this.circuitFileLoader();
    }
    return this.circuitFiles;
  }

  private async ensureCrossChainWithdrawalCircuitFiles(): Promise<CircuitFiles> {
    if (!this.crosschainCircuitFiles) {
      if (!this.crosschainCircuitFileLoader) {
        throw new Error(
          'Cross-chain circuit file loader not provided. Please provide a cross-chain circuit file loader in constructor.',
        );
      }
      this.crosschainCircuitFiles = await this.crosschainCircuitFileLoader();
    }
    return this.crosschainCircuitFiles;
  }

  /**
   * Generate a withdrawal proof using snarkjs
   *
   * @param args - Withdrawal proof arguments
   * @returns Proof data with proof and public signals
   */
  async generateWithdrawalProof(args: WithdrawalProofArgs): Promise<WithdrawalProofData> {
    console.log('🔧 Generating withdrawal proof...');

    // Ensure circuit files are loaded
    const circuitFiles = await this.ensureCircuitFiles();

    const {
      existingCommitmentHash,
      existingValue,
      existingNullifier,
      existingSecret,
      withdrawalValue,
      context,
      label,
      newNullifier,
      newSecret,
      stateTreeCommitments,
      aspTreeLabels,
    } = args;

    // Build Merkle trees
    const { stateTree, aspTree } = this.buildMerkleTrees(stateTreeCommitments, aspTreeLabels);

    // Find indices in trees
    const stateIndex = stateTreeCommitments.indexOf(existingCommitmentHash);
    const aspIndex = aspTreeLabels.indexOf(label);

    if (stateIndex === -1) {
      throw new Error('Existing commitment not found in state tree');
    }
    if (aspIndex === -1) {
      throw new Error('Commitment label not found in ASP tree');
    }

    // Generate Merkle proofs
    const stateProof = stateTree.generateProof(stateIndex);
    const aspProof = aspTree.generateProof(aspIndex);

    // Prepare circuit inputs
    const circuitInputs = this.prepareCircuitInputs({
      withdrawalValue,
      existingValue,
      existingNullifier,
      existingSecret,
      context,
      label,
      newNullifier,
      newSecret,
      stateProof,
      aspProof,
      stateTreeDepth: stateTree.depth,
      ASPTreeDepth: aspTree.depth,
      stateIndex: Object.is(stateProof.index, Number.NaN) ? 0 : stateProof.index,
      aspIndex: Object.is(aspProof.index, Number.NaN) ? 0 : aspProof.index,
    });

    // Generate proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInputs,
      circuitFiles.wasmFile,
      circuitFiles.zkeyFile,
    );

    // Verify proof
    const isValid = await this.verifyWithdrawalProof({ proof, publicSignals });

    if (!isValid) {
      throw new Error('Generated proof failed verification');
    }

    console.log('✅ Withdrawal proof generated and verified!');
    return { proof, publicSignals };
  }

  /**
   * Generate a cross-chain withdrawal proof using snarkjs
   *
   * @param args - Cross-chain withdrawal proof arguments
   * @returns Proof data with proof and public signals
   */
  async generateCrosschainWithdrawalProof(args: CrosschainWithdrawalProofArgs): Promise<WithdrawalProofData> {
    console.log('🔧 Generating crosschain withdrawal proof...');

    // Ensure circuit files are loaded
    const circuitFiles = await this.ensureCrossChainWithdrawalCircuitFiles();

    const {
      existingCommitmentHash,
      existingValue,
      existingNullifier,
      existingSecret,
      withdrawalValue,
      context,
      label,
      newNullifier,
      newSecret,
      stateTreeCommitments,
      aspTreeLabels,
      refundNullifier,
      refundSecret,
    } = args;

    // Build Merkle trees
    const { stateTree, aspTree } = this.buildMerkleTrees(stateTreeCommitments, aspTreeLabels);

    // Find indices in trees
    const stateIndex = stateTreeCommitments.indexOf(existingCommitmentHash);
    const aspIndex = aspTreeLabels.indexOf(label);

    if (stateIndex === -1) {
      throw new Error('Existing commitment not found in state tree');
    }
    if (aspIndex === -1) {
      throw new Error('Commitment label not found in ASP tree');
    }

    // Generate Merkle proofs
    const stateProof = stateTree.generateProof(stateIndex);
    const aspProof = aspTree.generateProof(aspIndex);

    // Prepare circuit inputs
    const circuitInputs = this.prepareCrossChainWithdrawalCircuitInputs({
      withdrawalValue,
      existingValue,
      existingNullifier,
      existingSecret,
      context,
      label,
      newNullifier,
      newSecret,
      refundNullifier,
      refundSecret,
      stateProof,
      aspProof,
      stateTreeDepth: stateTree.depth,
      ASPTreeDepth: aspTree.depth,
      stateIndex: Object.is(stateProof.index, Number.NaN) ? 0 : stateProof.index,
      aspIndex: Object.is(aspProof.index, Number.NaN) ? 0 : aspProof.index,
    });

    // Generate proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInputs,
      circuitFiles.wasmFile,
      circuitFiles.zkeyFile,
    );

    console.log('🔍 Cross-chain public signals mapping:');
    console.log('  [0] newCommitmentHash:', publicSignals[0]);
    console.log('  [1] existingNullifierHash:', publicSignals[1]);
    console.log('  [2] refundCommitmentHash:', publicSignals[2]);
    console.log('  [3] withdrawnValue:', publicSignals[3]);
    console.log('  [4] stateRoot:', publicSignals[4]);
    console.log('  [5] stateTreeDepth:', publicSignals[5]);
    console.log('  [6] ASPRoot:', publicSignals[6]);
    console.log('  [7] ASPTreeDepth:', publicSignals[7]);
    console.log('  [8] context:', publicSignals[8]);

    // Verify proof with cross-chain verification key
    const isValid = await this.verifyCrosschainWithdrawalProof({ proof, publicSignals });

    if (!isValid) {
      throw new Error('Generated proof failed verification');
    }

    console.log('✅ Cross-chain withdrawal proof generated and verified!');
    return { proof, publicSignals };
  }

  /**
   * Verify a withdrawal proof
   *
   * @param proofData - Proof data to verify
   * @returns true if proof is valid
   */
  async verifyWithdrawalProof(proofData: WithdrawalProofData): Promise<boolean> {
    console.log('🔍 Verifying withdrawal proof...');

    try {
      const circuitFiles = await this.ensureCircuitFiles();
      const isValid = await snarkjs.groth16.verify(circuitFiles.vkeyData, proofData.publicSignals, proofData.proof);

      console.log(`   ${isValid ? '✅ Valid' : '❌ Invalid'} proof`);
      return isValid;
    } catch (error) {
      console.error('   ❌ Verification failed:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Verify a cross-chain withdrawal proof
   *
   * @param proofData - Proof data to verify
   * @returns true if proof is valid
   */
  async verifyCrosschainWithdrawalProof(proofData: WithdrawalProofData): Promise<boolean> {
    console.log('🔍 Verifying cross-chain withdrawal proof...');

    try {
      const circuitFiles = await this.ensureCrossChainWithdrawalCircuitFiles();
      const isValid = await snarkjs.groth16.verify(circuitFiles.vkeyData, proofData.publicSignals, proofData.proof);

      console.log(`   ${isValid ? '✅ Valid' : '❌ Invalid'} proof`);
      return isValid;
    } catch (error) {
      console.error('   ❌ Verification failed:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  // ============ PRIVATE METHODS ============

  private buildMerkleTrees(stateTreeCommitments: bigint[], aspTreeLabels: bigint[]) {
    // Build state tree
    const stateTree = new LeanIMT(this.hash);
    for (const commitment of stateTreeCommitments) {
      stateTree.insert(commitment);
    }

    // Build ASP tree
    const aspTree = new LeanIMT(this.hash);
    for (const label of aspTreeLabels) {
      aspTree.insert(label);
    }

    return { stateTree, aspTree };
  }

  private prepareCircuitInputs(params: {
    withdrawalValue: bigint;
    existingValue: bigint;
    existingNullifier: bigint;
    existingSecret: bigint;
    context: bigint;
    label: bigint;
    newNullifier: bigint;
    newSecret: bigint;
    stateProof: LeanIMTMerkleProof<bigint>;
    aspProof: LeanIMTMerkleProof<bigint>;
    stateTreeDepth: number;
    ASPTreeDepth: number;
    stateIndex: number;
    aspIndex: number;
  }) {
    const {
      withdrawalValue,
      existingValue,
      existingNullifier,
      existingSecret,
      context,
      label,
      newNullifier,
      newSecret,
      stateProof,
      aspProof,
      stateTreeDepth,
      ASPTreeDepth,
      stateIndex,
      aspIndex,
    } = params;

    return {
      withdrawnValue: withdrawalValue.toString(),
      stateRoot: stateProof.root.toString(),
      ASPRoot: aspProof.root.toString(),
      stateTreeDepth: stateTreeDepth.toString(),
      ASPTreeDepth: ASPTreeDepth.toString(),
      context: context.toString(),
      label: label.toString(),
      existingValue: existingValue.toString(),
      existingNullifier: existingNullifier.toString(),
      existingSecret: existingSecret.toString(),
      newNullifier: newNullifier.toString(),
      newSecret: newSecret.toString(),
      stateSiblings: padArray(stateProof.siblings, MAX_TREE_DEPTH).map((s) => s.toString()),
      ASPSiblings: padArray(aspProof.siblings, MAX_TREE_DEPTH).map((s) => s.toString()),
      stateIndex: stateIndex,
      ASPIndex: aspIndex,
    };
  }

  private prepareCrossChainWithdrawalCircuitInputs(params: {
    withdrawalValue: bigint;
    existingValue: bigint;
    existingNullifier: bigint;
    existingSecret: bigint;
    context: bigint;
    label: bigint;
    newNullifier: bigint;
    newSecret: bigint;
    refundNullifier: bigint;
    refundSecret: bigint;
    stateProof: LeanIMTMerkleProof<bigint>;
    aspProof: LeanIMTMerkleProof<bigint>;
    stateTreeDepth: number;
    ASPTreeDepth: number;
    stateIndex: number;
    aspIndex: number;
  }) {
    const {
      withdrawalValue,
      existingValue,
      existingNullifier,
      existingSecret,
      context,
      label,
      newNullifier,
      newSecret,
      refundNullifier,
      refundSecret,
      stateProof,
      aspProof,
      stateTreeDepth,
      ASPTreeDepth,
      stateIndex,
      aspIndex,
    } = params;

    return {
      withdrawnValue: withdrawalValue.toString(),
      stateRoot: stateProof.root.toString(),
      ASPRoot: aspProof.root.toString(),
      stateTreeDepth: stateTreeDepth.toString(),
      ASPTreeDepth: ASPTreeDepth.toString(),
      context: context.toString(),
      label: label.toString(),
      existingValue: existingValue.toString(),
      existingNullifier: existingNullifier.toString(),
      existingSecret: existingSecret.toString(),
      newNullifier: newNullifier.toString(),
      newSecret: newSecret.toString(),
      refundNullifier: refundNullifier.toString(),
      refundSecret: refundSecret.toString(),
      stateSiblings: padArray(stateProof.siblings, MAX_TREE_DEPTH).map((s) => s.toString()),
      ASPSiblings: padArray(aspProof.siblings, MAX_TREE_DEPTH).map((s) => s.toString()),
      stateIndex: stateIndex,
      ASPIndex: aspIndex,
    };
  }
}
