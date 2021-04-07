import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}) {
  const { deploy } = deployments;
  const { deployer, pancakeRouter } = await getNamedAccounts();
  await deploy("Harvester", { from: deployer, args: [treasury], log: true });
};
export default func;
