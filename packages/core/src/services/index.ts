/**
 * Business Logic Services
 */

export { DepositService } from './DepositService.js';
export { NoteDiscoveryService, type ActivityFetcher } from './NoteDiscoveryService.js';
export {
  calculateContextHash,
  calculateWithdrawalContext,
  calculateCrosschainWithdrawalContext,
  hashToBigInt,
  SNARK_SCALAR_FIELD,
  type WithdrawalContext,
  type CrosschainWithdrawalContext,
} from './WithdrawalContextService.js';
