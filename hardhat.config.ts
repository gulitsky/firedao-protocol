import * as dotenv from "dotenv";
import { HardhatUserConfig, task } from "hardhat/config";

import "hardhat-spdx-license-identifier";
import "@nomiclabs/hardhat-ethers";
import "@typechain/hardhat";
import "hardhat-deploy";
import "@nomiclabs/hardhat-waffle";

dotenv.config();
const {
  HARDHAT_FORK_BSC = "true",
  MNEMONIC,
  OPTIMIZE = "true",
  OPTIMIZER_RUNS = "200",
  SOLIDITY_VERSION = "0.8.4",
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
      default: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
      "bsc-testnet": "0xD99D1c33F9fC3444f8101754aBC46c52416550D1",
      // "bsc-testnet": "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3"
    },
    usdt: {
      default: "0x55d398326f99059fF775485246999027B3197955",
      "bsc-testnet": "0xA11c8D9DC9b66E209Ef60F0C8D969D3CD988782c"
    },
    eth: {
      default: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
      "bsc-testnet": "0x98f7A83361F7Ac8765CcEBAB1425da6b341958a7",
    },
    dai: {
      default: "0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3",
      "bsc-testnet": "0xEC5dCb5Dbf4B114C9d0F65BcCAb49EC54F6A0867",
    },
    cake: {
      default: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
    },
    vUsdt: {
      default: "0xfD5840Cd36d94D7229439859C0112a4185BC0255",
      "bsc-testnet": "0xb7526572FFE56AB9D7489838Bf2E18e3323b441A"
    },
    vDai: {
      default: "0x334b3eCB4DCa3593BCCC3c7EBD1A1C1d1780FBF1",
    },
    unitroller: {
      default: "0xfD36E2c2a6789Db23113685031d7F16329158384",
      "bsc-testnet": "0x94d1820b2D1c7c7452A163983Dc888CEC546b77D"
    },
    xvs: {
      default: "0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63",
      "bsc-testnet": "0xB9e0E753630434d7863528cc73CB7AC638a7c8ff"
    },
    masterBelt: {
      default: "0xD4BbC80b9B102b77B21A06cb77E954049605E6c1",
    },
    belt: {
      default: "0xE0e514c71282b6f4e823703a39374Cf58dc3eA4f",
    },
    fourBelt: {
      default: "0x9cb73F20164e399958261c289Eb5F9846f4D1404",
    },
    bUsdT: {
      default: "0x55d398326f99059fF775485246999027B3197955",
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
    overwrite: true,
  },
};
export default config;
