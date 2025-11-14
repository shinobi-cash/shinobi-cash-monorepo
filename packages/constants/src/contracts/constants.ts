/**
 * Application Constants
 *
 * Centralized configuration values, limits, and constants used throughout the application.
 * Organized by category for easy maintenance.
 */

import { CrosschainWithdrawalPaymasterAbi } from "../abi/CrosschainWithdrawalPaymasterAbi";
import { ShinobiCashEntrypointAbi } from "../abi/ShinobiCashEntrypointAbi";
import { ShinobiCashPoolAbi } from "../abi/ShinobiCashPoolAbi";
import { ShinobiCrosschainDepositEntrypointAbi } from "../abi/ShinobiCrosschainDepositEntrypointAbi";
import { ShinobiDepositOutputSettlerAbi } from "../abi/ShinobiDepositOutputSettlerAbi";
import { ShinobiWithdrawalOutputSettlerAbi } from "../abi/ShinobiWithdrawalOutputSettlerAbi";
import { SimpleShinobiCashPoolPaymasterAbi } from "../abi/SimpleShinobiCashPoolPaymasterAbi";

// ============ WITHDRAWAL CONSTANTS ============

/**
 * Default withdrawal account private key (deterministic for testing)
 * This should be moved to environment variables in production
 */
export const WITHDRAWAL_ACCOUNT_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as `0x${string}`;

/**
 * Default withdrawal fee rates
 */
export const WITHDRAWAL_FEES = {
  DEFAULT_RELAY_FEE_BPS: BigInt(1500), // 15% relay fee in basis points
  DEFAULT_SOLVER_FEE_BPS: BigInt(500),  // 5% solver fee in basis points
} as const;

/**
 * Default deposit fee rates for cross-chain deposits
 */
export const DEPOSIT_FEES = {
  DEFAULT_SOLVER_FEE_BPS: 500, // 5% solver fee in basis points (uint256 for contract)
} as const;

/**
 * Gas limits for Account Abstraction operations
 */
export const GAS_LIMITS = {
  PAYMASTER_POST_OP_GAS_LIMIT: 35000n, // Above the 32,000 minimum
} as const;

// ============ ZK CIRCUIT CONSTANTS ============

/**
 * Zero-knowledge proof and circuit parameters
 */
export const SNARK_SCALAR_FIELD = "21888242871839275222246405745257275088548364400416034343698204186575808495617";

// ============ INDEXER CONSTANTS ============

/**
 * IPFS configuration
 */
export const IPFS_GATEWAY_URL = "https://gateway.pinata.cloud/ipfs/";

// Deployed contract addresses
export const CONTRACTS = {
  // Expected smart account for deterministic pattern
  EXPECTED_SMART_ACCOUNT: "0xa3aBDC7f6334CD3EE466A115f30522377787c024",

} as const;

const SUPPORTED_CROSSCHAINS_NETWORK = [{
    chainId: 84532,
    name: "Base Sepolia",
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: "https://sepolia.basescan.org",
  }
]

const POOL_CHAIN_NETWORK = {
  chainId: 421614,
  name: "Arbitrum Sepolia",
  rpcUrl: '',
  explorerUrl: "https://sepolia.arbiscan.io",
}

const crosschainConfig = {
  84532: {
    shinobiCashCrosschainDepositEntrypoint:{
      address:'0x3f0351cdd05616B1807C177592ccB81b3220b5Ff',
      blockNumber:33607182,
      abi:ShinobiCrosschainDepositEntrypointAbi
    },
    withdrawalOutputSettler:{
      address: "0x621Ca010AE73309cF1FF6E75D53d26BEBCB0cfDe",
      blockNumber:33603332,
      abi:ShinobiWithdrawalOutputSettlerAbi
    },
    depositInputSettler:{
      address:'0x9F5f52D0E481BfDA8028F64E7BA2fA76A897237b',
      blockNumber:33607221,
      abi:[]
    },
    fillOracle:{
      address:'0x',
      blockNumber:0,
      abi:[]
    },
  },
  
} as const

const poolChainConfig = {
  421614:{
    shinobiCashEntrypoint:{
      address:'0x11C3E1332893A3E34273e6c81f245fA7fB84A52d',
      blockNumber:214546382,
      abi:ShinobiCashEntrypointAbi
    },
    shinobiCashEthPool:{
      address:'0x5543b250b8a44513BA91C0346BeE40890FfD7D18',
      blockNumber:214550187,
      abi:ShinobiCashPoolAbi
    },
    withdrawalInputSettler:{
      address: "0x31105923593a7A02F8CDE2e048E0acd178F5e4c5",
      blockNumber:214550522,
      abi:[]
    },
    depositOutputSettler:{
      address: "0x0B44BE1cA20749aa2ac2A4f078188f0E14d9DcA2",
      blockNumber:214550698,
      abi:ShinobiDepositOutputSettlerAbi
    },
    samechainWithdrawalPaymaster:{
      address:'0x4d09818A2C5Dc21D3EA4Ef93D721c52696fC31F3',
      blockNumber:214552085,
      abi:SimpleShinobiCashPoolPaymasterAbi
    },
    crosschainWithdrawalPaymaster:{
      address:'0x9b50Dc7e1972AAc8c3628CCF3074D3e011491445',
      blockNumber:0,
      abi:CrosschainWithdrawalPaymasterAbi
    },
    fillOracle:{
      address:'0x4cb20f4415d3666e5d92e261de98fc9b7843d036',
      blockNumber:0,
      abi:[]
    },
    intentOracle:{
      address:'0x4cb20f4415d3666e5d92e261de98fc9b7843d036',
      blockNumber:0,
      abi:[]
    },
  }
} as const

  