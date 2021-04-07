import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}) {
  const { deploy } = deployments;
  const { deployer, treasury } = await getNamedAccounts();
  await deploy("FIRE", { from: deployer, args: [treasury], log: true });
};
export default func;
