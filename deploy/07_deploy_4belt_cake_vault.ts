import { DeployFunction } from "hardhat-deploy/types";

const PID = 3;

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}) {
  const { deploy } = deployments;
  const { deployer, cake, fourBelt, masterBelt, belt, pancakeRouter, bUsdT } =
    await getNamedAccounts();
  const harvester = await deployments.get("Harvester");
  const timelock = await deployments.read("GovernorAlpha", "timelock");

  const vault = await deploy("Vault", {
    from: deployer,
    args: [fourBelt, cake, harvester.address, timelock],
    log: true,
  });

  const beltFiStrategy = await deploy("BeltFiStrategy", {
    from: deployer,
    args: [
      vault.address,
      masterBelt,
      PID,
      fourBelt,
      belt,
      timelock,
      pancakeRouter,
      [belt, bUsdT, fourBelt],
    ],
    log: true,
  });
  await deployments.execute(
    "Vault",
    { from: deployer },
    "setStrategy",
    beltFiStrategy.address,
    true,
  );
};
export default func;
