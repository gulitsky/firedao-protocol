import { network } from "hardhat";

export const advanceBlock = async () => {
  await network.provider.request({ method: "evm_mine" });
};
