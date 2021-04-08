import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const fire = await deployments.get("FIRE");

  await deploy("GovernorAlpha", {
    from: deployer,
    args: [fire.address],
    log: true,
  });
};
export default func;
