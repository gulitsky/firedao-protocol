import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}) {
  const { deploy } = deployments;
  const { deployer, fireKeeper } = await getNamedAccounts();
  await deploy("FIRE", { from: deployer, args: [fireKeeper], log: true });
};
export default func;
