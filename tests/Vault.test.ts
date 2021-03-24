import { ethers } from "hardhat";
import { Vault__factory as VaultFactory } from "./../typechain";

describe("Vault", () => {
  it("Should", async () => {
    const [wallet] = await ethers.getSigners();

    const vault = await new VaultFactory(wallet).deploy();
  });
});
