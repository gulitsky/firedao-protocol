import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";

import "hardhat-spdx-license-identifier";
import "@nomiclabs/hardhat-ethers";
import "hardhat-typechain";
import "@nomiclabs/hardhat-waffle";

dotenv.config();
const {
  HARDHAT_FORK_BSC = "true",
  MNEMONIC,
  NODE_ENV = "development",
  OPTIMIZE = "true",
  OPTIMIZER_RUNS = "200",
  SOLIDITY_VERSION = "0.8.3",
} = process.env;

const isProduction = () => NODE_ENV === "production";

if (!MNEMONIC) {
  console.error(
    "✖ Please set your MNEMONIC in environment variable or .env file",
  );
  process.exit(1);
}
const accounts = {
  mnemonic: MNEMONIC,
};

const config: HardhatUserConfig = {
  solidity: {
    version: SOLIDITY_VERSION,
    settings: {
      optimizer: {
        enabled: OPTIMIZE && OPTIMIZE === "true" ? true : false,
        runs: parseInt(OPTIMIZER_RUNS),
      },
    },
  },
  networks: {
    hardhat: {
      accounts,
      forking: {
        enabled: HARDHAT_FORK_BSC && HARDHAT_FORK_BSC === "true" ? true : false,
        url: "https://bsc-dataseed1.binance.org",
      },
    },
    bsc: {
      accounts,
      url: "https://bsc-dataseed.binance.org",
      chainId: 56,
    },
    bsc_testnet: {
      accounts,
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
    },
  },
  paths: {
    tests: "./tests/",
  },
  typechain: {
    target: "ethers-v5",
  },
  spdxLicenseIdentifier: {
    runOnCompile: true,
  },
};
export default config;
