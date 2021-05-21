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
  const vault = await deployments.get("Vault");
  const timelock = await deployments.read("GovernorAlpha", "timelock");

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
