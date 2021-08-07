import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}) {
  const { deploy } = deployments;
  const { deployer, usdt, eth } = await getNamedAccounts();
  const harvester = await deployments.get("Harvester");
  const timelock = await deployments.read("GovernorAlpha", "timelock");

  await deploy("Vault", {
    from: deployer,
    args: [usdt, eth, harvester.address, timelock],
    log: true,
  });
};
export default func;
