import { ethers, network } from "hardhat";
import { SECONDS_PER_BLOCK } from "./constants";

export const advanceBlock = async () => {
  await network.provider.request({ method: "evm_mine" });
};

export const advanceBlocks = async (blocks: number) => {
  const block = await ethers.provider.getBlock("latest");
  for (let i = 0; i < blocks; i++) {
    await network.provider.request({
      method: "evm_mine",
      params: [block.timestamp + (i + 1) * SECONDS_PER_BLOCK],
    });
  }
};

export const advanceTime = async (seconds: number) => {
  await network.provider.request({
    method: "evm_increaseTime",
    params: [seconds],
  });
  await advanceBlock();
};
