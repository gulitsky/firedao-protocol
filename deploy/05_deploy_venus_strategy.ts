import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}) {
  const { deploy } = deployments;
  const {
    deployer,
    usdt,
    pancakeRouter,
    vUsdt,
    unitroller,
    xvs,
  } = await getNamedAccounts();
  const vault = await deployments.get("Vault");
  const timelock = await deployments.read("GovernorAlpha", "timelock");

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
      false,
    ],
    log: true,
  });
  await deployments.execute(
    "Vault",
    { from: deployer },
    "setStrategy",
    venusStrategy.address,
    true,
  );
};
export default func;
