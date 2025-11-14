/**
 * Note Discovery Service - Pure business logic
 *
 * Discovers notes belonging to a user by scanning indexed blockchain data.
 * Uses cryptographic derivation to match deposits and track withdrawals.
 */

import type { Activity } from '@shinobi-cash/data';
import type { DiscoveryResult, Note, NoteChain, DiscoveryProgress, DiscoveryOptions } from '../types/index.js';
import {
  deriveChangeNullifier,
  deriveDepositNullifier,
  deriveDepositSecret,
} from '../crypto/noteDerivation.js';
import { poseidon1, poseidon2 } from 'poseidon-lite';
import type { INoteStorageProvider } from '../interfaces/INoteStorageProvider.js';

const ACTIVITIES_PER_PAGE = 100;

/**
 * Activity fetcher function type
 * Applications must provide this to fetch activities from their indexer
 */
export type ActivityFetcher = (
  poolAddress: string,
  limit: number,
  cursor?: string,
  orderDirection?: 'asc' | 'desc',
) => Promise<{
  items: Activity[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor?: string;
  };
}>;

/**
 * Note Discovery Service
 *
 * Discovers user's notes by scanning indexed activity data and using
 * cryptographic derivation to match deposits and track withdrawals.
 *
 * @example
 * ```typescript
 * const discoveryService = new NoteDiscoveryService(
 *   storageProvider,
 *   async (poolAddress, limit, cursor) => {
 *     const client = getShinobiClient();
 *     return client.query()
 *       .activities()
 *       .byPool(poolAddress)
 *       .limit(limit)
 *       .skip(cursor ? Number(cursor) : 0)
 *       .execute();
 *   }
 * );
 *
 * const result = await discoveryService.discoverNotes(
 *   publicKey,
 *   poolAddress,
 *   accountKey,
 *   {
 *     onProgress: (progress) => console.log(`Processed ${progress.pagesProcessed} pages`),
 *     signal: abortController.signal
 *   }
 * );
 * ```
 */
export class NoteDiscoveryService {
  constructor(
    private storageProvider: INoteStorageProvider,
    private fetchActivities: ActivityFetcher,
  ) {}

  /**
   * Discover notes for an account
   *
   * Scans indexed activities to find deposits matching the account's
   * cryptographic derivation, then tracks withdrawals to build note chains.
   *
   * @param publicKey - User's public key/address
   * @param poolAddress - Pool contract address
   * @param accountKey - Account key for cryptographic derivation
   * @param options - Discovery options (progress callback, abort signal)
   * @returns Discovery result with found notes
   */
  async discoverNotes(
    publicKey: string,
    poolAddress: string,
    accountKey: bigint,
    options?: DiscoveryOptions,
  ): Promise<DiscoveryResult> {
    const { signal, onProgress, maxPages, pageSize = ACTIVITIES_PER_PAGE } = options || {};

    // Initialize progress
    const progress: DiscoveryProgress = {
      pagesProcessed: 0,
      currentPageActivityCount: 0,
      depositsChecked: 0,
      depositsMatched: 0,
      lastCursor: undefined,
      complete: false,
    };

    onProgress?.(progress);

    // Load cache to resume state
    const cached = await this.storageProvider.getCachedNotes(publicKey, poolAddress);
    const notes: NoteChain[] = cached?.notes ? [...cached.notes] : [];
    let lastUsedIndex = cached?.lastUsedIndex ?? -1;
    let nextDepositIndex = lastUsedIndex + 1;

    // Track live deposits for extension
    type LiveDeposit = { depositIndex: number; chainIndex: number; remaining: bigint };
    let liveDeposits: LiveDeposit[] = [];

    // Initialize live deposits from cache (only activated notes with amounts)
    notes.forEach((chain, idx) => {
      const last = chain[chain.length - 1];
      if (last.status === 'unspent' && last.amount && BigInt(last.amount) > 0n && last.isActivated) {
        liveDeposits.push({
          depositIndex: chain[0]!.depositIndex,
          chainIndex: idx,
          remaining: BigInt(last.amount),
        });
      }
    });

    let cursor = cached?.lastProcessedCursor || undefined;
    let hasNext = true;
    let pagesProcessed = 0;

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    // Main discovery loop
    while (hasNext && (!maxPages || pagesProcessed < maxPages)) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const activitiesResult = await this.fetchActivities(poolAddress, pageSize, cursor, 'asc');
      const activities: Activity[] = activitiesResult.items;
      cursor = activitiesResult.pageInfo.endCursor;
      pagesProcessed++;

      progress.pagesProcessed = pagesProcessed;
      progress.currentPageActivityCount = activities.length;
      progress.lastCursor = cursor;
      onProgress?.(progress);

      // 1) Extend live deposits using this page's activities
      if (liveDeposits.length > 0) {
        for (const liveDeposit of [...liveDeposits]) {
          const chain = notes[liveDeposit.chainIndex];
          if (!chain) continue;

          const withdrawalsMatched = this.extendChainInPlace(chain, activities, accountKey, poolAddress);
          if (withdrawalsMatched > 0) {
            const lastNote = chain[chain.length - 1]!;
            if (lastNote.status === 'spent' || !lastNote.amount || BigInt(lastNote.amount) <= 0n) {
              liveDeposits = liveDeposits.filter(
                (deposit) =>
                  !(deposit.depositIndex === liveDeposit.depositIndex && deposit.chainIndex === liveDeposit.chainIndex),
              );
            } else {
              const newRemaining = BigInt(lastNote.amount);
              liveDeposits = liveDeposits.map((deposit) =>
                deposit.depositIndex === liveDeposit.depositIndex && deposit.chainIndex === liveDeposit.chainIndex
                  ? { ...deposit, remaining: newRemaining }
                  : deposit,
              );
            }
          }
        }
        onProgress?.(progress);
      }

      // 2) Scan for new deposits
      while (true) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const candidateDepositIndex = nextDepositIndex;
        const depositNullifier = deriveDepositNullifier(accountKey, poolAddress, candidateDepositIndex);
        const depositSecret = deriveDepositSecret(accountKey, poolAddress, candidateDepositIndex);
        const targetPrecommitment = poseidon2([depositNullifier, depositSecret]).toString();

        progress.depositsChecked++;
        onProgress?.(progress);

        const depositPosition = activities.findIndex(
          (activity) =>
            (activity.type === 'DEPOSIT' || activity.type === 'CROSSCHAIN_DEPOSIT') &&
            activity.precommitmentHash === targetPrecommitment,
        );

        if (depositPosition === -1) break;

        const depositActivity = activities[depositPosition]!;
        const activitiesAfter = activities.slice(depositPosition + 1);

        const { chain: newChain } = this.buildChainForDepositInPage(
          depositActivity,
          candidateDepositIndex,
          activitiesAfter,
          accountKey,
          poolAddress,
        );

        notes.push(newChain);
        const newChainIndex = notes.length - 1;

        const lastNote = newChain[newChain.length - 1]!;
        if (lastNote.status === 'unspent' && lastNote.amount && BigInt(lastNote.amount) > 0n && lastNote.isActivated) {
          liveDeposits.push({
            depositIndex: candidateDepositIndex,
            chainIndex: newChainIndex,
            remaining: BigInt(lastNote.amount),
          });
        }

        progress.depositsMatched++;
        lastUsedIndex = Math.max(lastUsedIndex, candidateDepositIndex);
        nextDepositIndex = candidateDepositIndex + 1;
      }

      // 3) Persist after processing page
      await this.storageProvider.storeDiscoveredNotes(publicKey, poolAddress, notes, cursor);

      progress.pagesProcessed = pagesProcessed;
      progress.currentPageActivityCount = activities.length;
      progress.lastCursor = cursor;
      onProgress?.(progress);

      hasNext = activitiesResult.pageInfo.hasNextPage;
      if (!hasNext) break;
    }

    progress.complete = true;
    onProgress?.(progress);

    return {
      notes,
      lastUsedIndex,
      newNotesFound: progress.depositsMatched,
      lastProcessedCursor: cursor,
    };
  }

  /**
   * Extend chain in place by finding withdrawals
   * @private
   */
  private extendChainInPlace(
    chain: NoteChain,
    pageActivities: Activity[],
    accountKey: bigint,
    poolAddress: string,
  ): number {
    let withdrawalsMatched = 0;
    const lastNote = chain[chain.length - 1]!;

    // Skip extending pending deposits (amount is null until filled by solver)
    if (lastNote.amount === null || lastNote.amount === undefined) {
      return 0;
    }

    let remaining = BigInt(lastNote.amount);
    let changeIndex = lastNote.changeIndex === 0 ? 1 : lastNote.changeIndex + 1;

    let currentNullifier: bigint;
    if (lastNote.changeIndex === 0) {
      currentNullifier = deriveDepositNullifier(accountKey, poolAddress, chain[0]!.depositIndex);
    } else {
      currentNullifier = deriveChangeNullifier(accountKey, poolAddress, chain[0]!.depositIndex, lastNote.changeIndex);
    }

    while (true) {
      const nullifierHash = poseidon1([currentNullifier]).toString();

      const withdrawal = pageActivities.find(
        (activity) =>
          (activity.type === 'WITHDRAWAL' || activity.type === 'CROSSCHAIN_WITHDRAWAL') &&
          activity.spentNullifier === nullifierHash,
      );

      if (!withdrawal || !withdrawal.newCommitment || !withdrawal.amount) break;

      chain[chain.length - 1]!.status = 'spent';
      remaining -= BigInt(withdrawal.amount);

      const changeNote: Note = {
        poolAddress: chain[0]!.poolAddress,
        depositIndex: chain[0]!.depositIndex,
        changeIndex,
        noteType: 'change',
        amount: remaining.toString(),
        originTransactionHash: withdrawal.originTransactionHash,
        destinationTransactionHash: withdrawal.destinationTransactionHash || withdrawal.originTransactionHash,
        originChainId: withdrawal.originChainId.toString(),
        destinationChainId: (withdrawal.destinationChainId || withdrawal.originChainId).toString(),
        blockNumber: withdrawal.blockNumber.toString(),
        timestamp: withdrawal.timestamp.toString(),
        status: remaining > 0n ? 'unspent' : 'spent',
        isActivated: true, // Change notes are always activated
        label: chain[0]!.label,
        refundCommitment: withdrawal.refundCommitment,
      };

      chain.push(changeNote);
      withdrawalsMatched++;

      if (remaining <= 0n) break;

      currentNullifier = deriveChangeNullifier(accountKey, poolAddress, chain[0]!.depositIndex, changeIndex);
      changeIndex++;
    }

    return withdrawalsMatched;
  }

  /**
   * Build chain for deposit
   * @private
   */
  private buildChainForDepositInPage(
    depositActivity: Activity,
    depositIndex: number,
    pageActivitiesAfter: Activity[],
    accountKey: bigint,
    poolAddress: string,
  ): { chain: NoteChain } {
    const depositNote: Note = {
      poolAddress,
      depositIndex,
      changeIndex: 0,
      noteType: 'deposit',
      amount: depositActivity.amount ? depositActivity.amount.toString() : '0',
      originTransactionHash: depositActivity.originTransactionHash,
      destinationTransactionHash: depositActivity.destinationTransactionHash || depositActivity.originTransactionHash,
      originChainId: depositActivity.originChainId.toString(),
      destinationChainId: (depositActivity.destinationChainId || depositActivity.originChainId).toString(),
      blockNumber: depositActivity.blockNumber.toString(),
      timestamp: depositActivity.timestamp.toString(),
      status: 'unspent',
      isActivated: depositActivity.label != null,
      label: depositActivity.label || `Pending Deposit #${depositIndex}`,
    };

    const chain: NoteChain = [depositNote];
    this.extendChainInPlace(chain, pageActivitiesAfter, accountKey, poolAddress);

    return { chain };
  }
}
