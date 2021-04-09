import * as dotenv from "dotenv";
import { HardhatUserConfig, task } from "hardhat/config";

import "hardhat-spdx-license-identifier";
import "@nomiclabs/hardhat-ethers";
import "hardhat-typechain";
import "hardhat-deploy";
import "@nomiclabs/hardhat-waffle";

dotenv.config();
const {
  HARDHAT_FORK_BSC = "true",
  MNEMONIC,
  OPTIMIZE = "true",
  OPTIMIZER_RUNS = "200",
  SOLIDITY_VERSION = "0.8.3",
} = process.env;

if (!MNEMONIC) {
  console.error(
    "✖ Please set your MNEMONIC in environment variable or .env file",
  );
  process.exit(1);
}
const accounts = {
  mnemonic: MNEMONIC,
};

task("accounts", "Prints the list of accounts", async (args, hre) => {
  const accounts = await hre.ethers.getSigners();
  for (const [index, account] of accounts.entries()) {
    console.log(`${index}: ${await account.getAddress()}`);
  }
});

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
  namedAccounts: {
    deployer: {
      default: 0,
    },
    treasury: {
      default: 1,
    },
    fireKeeper: {
      default: 2,
    },
    pancakeRouter: {
      default: "0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F",
      "bsc-testnet": "0xD99D1c33F9fC3444f8101754aBC46c52416550D1",
    },
    dai: {
      default: "0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3",
      "bsc-testnet": "0xEC5dCb5Dbf4B114C9d0F65BcCAb49EC54F6A0867",
    },
    cake: {
      default: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
    },
    vDai: {
      default: "0x334b3eCB4DCa3593BCCC3c7EBD1A1C1d1780FBF1",
    },
    unitroller: {
      default: "0xfD36E2c2a6789Db23113685031d7F16329158384",
    },
    xvs: {
      default: "0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63",
    },
  },
  networks: {
    hardhat: {
      accounts,
      forking: {
        enabled: HARDHAT_FORK_BSC && HARDHAT_FORK_BSC === "true" ? true : false,
        url: "https://bsc-dataseed1.binance.org",
      },
      tags: ["local", "test"],
    },
    bsc: {
      accounts,
      url: "https://bsc-dataseed.binance.org",
      chainId: 56,
      tags: ["production"],
    },
    "bsc-testnet": {
      accounts,
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      tags: ["staging"],
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
