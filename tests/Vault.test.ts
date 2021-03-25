import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  IERC20Metadata as ERC20,
  IERC20Metadata__factory as ERC20Factory,
  IPancakeRouter__factory as PancakeRouterFactory,
  IPancakeRouter as PancakeRouter,
  Harvester,
  Harvester__factory as HarversterFactory,
  Vault__factory as VaultFactory,
  Vault,
} from "./../typechain";

const DAI_ADDRESS = "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3";
const CAKE_ADDRESS = "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82";
const PANCAKE_ROUTER_ADDRESS = "0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F";

describe("Vault", () => {
  let dai: ERC20, cake: ERC20;
  let pancakeRouter: PancakeRouter;
  let governance: SignerWithAddress;
  let harvester: Harvester;
  let vault: Vault;

  beforeAll(async () => {
    [governance] = await ethers.getSigners();

    dai = ERC20Factory.connect(DAI_ADDRESS, governance);
    cake = ERC20Factory.connect(CAKE_ADDRESS, governance);

    pancakeRouter = PancakeRouterFactory.connect(
      PANCAKE_ROUTER_ADDRESS,
      governance,
    );

    harvester = await new HarversterFactory(governance).deploy(
      pancakeRouter.address,
    );
  });

  beforeEach(async () => {
    vault = await new VaultFactory(governance).deploy(
      dai.address,
      cake.address,
      harvester.address,
    );
  });

  test("Should be deployed with сorrect name, symbol, and addresses", async () => {
    const daiSymbol = await dai.symbol();
    const cakeSymbol = await cake.symbol();
    expect(await vault.name()).toBe(
      `FIREDAO ${daiSymbol} to ${cakeSymbol} Yield Token`,
    );
    expect(await vault.symbol()).toBe(`fi${daiSymbol}->${cakeSymbol}`);

    expect(await vault.harvester()).toBe(harvester.address);
    expect(await vault.underlying()).toBe(dai.address);
    expect(await vault.target()).toBe(cake.address);
  });
});
