import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}) {
  const { deploy } = deployments;
  const {
    deployer,
    dai,
    pancakeRouter,
    vDai,
    unitroller,
    xvs,
  } = await getNamedAccounts();
  const harvester = await deployments.get("Harvester");
  const timelock = await deployments.read("GovernorAlpha", "timelock");

  const vault = await deploy("DirectVault", {
    from: deployer,
    args: [dai, harvester.address, timelock],
    log: true,
  });

  const venusStrategy = await deploy("VenusStrategy", {
    from: deployer,
    args: [
      vault.address,
      vDai,
      unitroller,
      xvs,
      timelock,
      pancakeRouter,
      [xvs, dai],
    ],
    log: true,
  });
  await deployments.execute(
    "DirectVault",
    { from: deployer },
    "setStrategy",
    venusStrategy.address,
    true,
  );
};
export default func;
