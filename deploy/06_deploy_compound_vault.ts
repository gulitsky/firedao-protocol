import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}) {
  const { deploy } = deployments;
  const { deployer, usdt, pancakeRouter, vUsdt, unitroller, xvs } =
    await getNamedAccounts();
  const harvester = await deployments.get("Harvester");
  const timelock = await deployments.read("GovernorAlpha", "timelock");

  const vault = await deploy("CompoundVault", {
    from: deployer,
    args: [usdt, harvester.address, timelock],
    log: true,
  });

  const venusStrategy = await deploy("VenusStrategy", {
    from: deployer,
    args: [
      vault.address,
      vUsdt,
      unitroller,
      xvs,
      timelock,
      pancakeRouter,
      [xvs, usdt],
      true,
    ],
    log: true,
  });
  await deployments.execute(
    "CompoundVault",
    { from: deployer },
    "setStrategy",
    venusStrategy.address,
    true,
  );
};
export default func;
