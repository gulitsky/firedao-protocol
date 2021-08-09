import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { ethers, network } from "hardhat";

export const impersonate = async (
  account: string,
): Promise<SignerWithAddress> => {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [account],
  });
  const signer = await ethers.getSigner(account);
  return signer;
};
