import "@nomiclabs/hardhat-ethers";
import { task, types } from "hardhat/config";

task("create-vault", "Creates the vault")
  .addParam(
    "underlying",
    "The address of the underlying token",
    undefined,
    types.string,
  )
  .addParam(
    "target",
    "The address of the target token",
    undefined,
    types.string,
  )
  .addOptionalParam(
    "vToken",
    "The address of the corresponding vToken for Venus Strategies",
    undefined,
    types.string,
  )
  .addOptionalParam("pid", "Belt.fi pool ID", undefined, types.int)
  .setAction(async ({ underlying, target, vToken, pid }, hre) => {
    const {
      pancakeRouter,
      unitroller,
      xvs,
      fourBelt,
      masterBelt,
      belt,
      bUsdT,
    } = await hre.getNamedAccounts();

    const harvester = await hre.ethers.getContract("Harvester");
    const governorAlpha = await hre.ethers.getContract("GovernorAlpha");
    const farm = await hre.ethers.getContract("Farm");
    const timelock = await governorAlpha.timelock();

    let vault, strategy;
    if (underlying !== fourBelt) {
      if (underlying === target) {
        const compoundVaultFactory = await hre.ethers.getContractFactory(
          "CompoundVault",
        );
        vault = await compoundVaultFactory.deploy(
          underlying,
          harvester.address,
          timelock,
          farm.address,
        );
      } else {
        const vaultFactory = await hre.ethers.getContractFactory("Vault");
        vault = await vaultFactory.deploy(
          underlying,
          target,
          harvester.address,
          timelock,
          farm.address,
        );
      }
      console.info(`Compound Vault: ${vault.address}`);
      const venusStrategyFactory = await hre.ethers.getContractFactory(
        "VenusStrategy",
      );
      strategy = await venusStrategyFactory.deploy(
        vault.address,
        vToken,
        unitroller,
        xvs,
        timelock,
        pancakeRouter,
        [xvs, underlying],
        underlying === target,
      );
      console.debug(`Venus Strategy: ${strategy.address}`);
    } else {
      const vaultFactory = await hre.ethers.getContractFactory("Vault");
      vault = await vaultFactory.deploy(
        underlying,
        target,
        harvester.address,
        timelock,
        farm.address,
      );

      console.info(`Vault: ${vault.address}`);
      const beltFiStrategyFactory = await hre.ethers.getContractFactory(
        "BeltFiStrategy",
      );
      strategy = await beltFiStrategyFactory.deploy(
        vault.address,
        masterBelt,
        pid,
        fourBelt,
        belt,
        timelock,
        pancakeRouter,
        [belt, bUsdT, fourBelt],
      );
      console.debug(`Belt.fi Strategy: ${strategy.address}`);
    }

    await vault.setStrategy(strategy.address, true);
    await farm.addVault(vault.address);
  });
