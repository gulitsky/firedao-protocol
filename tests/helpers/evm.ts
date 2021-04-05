import { network } from "hardhat";

export const advanceBlock = async () => {
  await network.provider.request({ method: "evm_mine" });
};

export const advanceTime = async (seconds: number) => {
  await network.provider.request({
    method: "evm_increaseTime",
    params: [seconds],
  });
  await advanceBlock();
};
