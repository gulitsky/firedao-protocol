import { network } from "hardhat";

export const impersonate = async (account: string) => {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [account],
  });
};
