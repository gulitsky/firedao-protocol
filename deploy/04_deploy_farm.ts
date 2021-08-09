import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}) {
  const { deploy, execute } = deployments;
  const { deployer, fireBUsdLpToken, fireKeeper } = await getNamedAccounts();

  const fire = await deployments.get("FIRE");
  const farm = await deploy("Farm", {
    from: deployer,
    args: [fire.address, fireBUsdLpToken],
    log: true,
  });

  await execute(
    "FIRE",
    { from: fireKeeper, log: true },
    "setOwner",
    farm.address,
  );
};
export default func;
