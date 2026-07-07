import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "dotenv/config";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import type { HardhatUserConfig } from "hardhat/config";
import { vars } from "hardhat/config";
import "solidity-coverage";

const MNEMONIC = vars.get("MNEMONIC", "test test test test test test test test test test test junk");
const INFURA_API_KEY = vars.get("INFURA_API_KEY", "");
const ETHERSCAN_API_KEY = vars.get("ETHERSCAN_API_KEY", "");
const SEPOLIA_RPC_URL = vars.get("SEPOLIA_RPC_URL", INFURA_API_KEY ? `https://sepolia.infura.io/v3/${INFURA_API_KEY}` : "");
const SEPOLIA_PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY?.trim();
const SEPOLIA_ACCOUNT = SEPOLIA_PRIVATE_KEY
  ? SEPOLIA_PRIVATE_KEY.startsWith("0x")
    ? SEPOLIA_PRIVATE_KEY
    : `0x${SEPOLIA_PRIVATE_KEY}`
  : undefined;

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: 0
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY
    }
  },
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS === "true",
    excludeContracts: []
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic: MNEMONIC
      },
      chainId: 31337
    },
    localhost: {
      accounts: {
        mnemonic: MNEMONIC
      },
      chainId: 31337,
      url: process.env.LOCALHOST_RPC_URL ?? process.env.PAAYEE_DEPLOYER_RPC_URL ?? "http://127.0.0.1:8545"
    },
    anvil: {
      accounts: {
        mnemonic: MNEMONIC,
        path: "m/44'/60'/0'/0/",
        count: 10
      },
      chainId: 31337,
      url: "http://localhost:8545"
    },
    sepolia: {
      accounts: SEPOLIA_ACCOUNT ? [SEPOLIA_ACCOUNT] : [],
      chainId: 11155111,
      url: process.env.SEPOLIA_RPC_URL || SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com"
    }
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test"
  },
  solidity: {
    compilers: [
      {
        version: "0.8.27",
        settings: {
          metadata: {
            bytecodeHash: "none"
          },
          optimizer: {
            enabled: true,
            runs: 200
          },
          evmVersion: "cancun"
        }
      }
    ]
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6"
  }
};

export default config;
