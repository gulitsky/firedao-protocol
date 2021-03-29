import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  IERC20Metadata as ERC20,
  IERC20Metadata__factory as ERC20Factory,
  IPancakeRouter__factory as PancakeRouterFactory,
  IPancakeRouter as PancakeRouter,
  Harvester,
  Harvester__factory as HarversterFactory,
} from "./../typechain";

const WHALE_ADDRESS = "0x46b513dD578D7BBc1D86c45c9A6CC687C942704B";
const DAI_ADDRESS = "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3";
const CAKE_ADDRESS = "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82";
const PANCAKE_ROUTER_ADDRESS = "0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F";

describe("Harvester", () => {
  let governance: SignerWithAddress, whale: SignerWithAddress;
  let dai: ERC20, cake: ERC20;
  let pancakeRouter: PancakeRouter;
  let harvester: Harvester;

  beforeAll(async () => {
    [governance] = await ethers.getSigners();

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [WHALE_ADDRESS],
    });
    whale = await ethers.getSigner(WHALE_ADDRESS);

    dai = ERC20Factory.connect(DAI_ADDRESS, whale);
    cake = ERC20Factory.connect(CAKE_ADDRESS, whale);

    pancakeRouter = PancakeRouterFactory.connect(
      PANCAKE_ROUTER_ADDRESS,
      governance,
    );
  });

  beforeEach(async () => {
    harvester = await new HarversterFactory(governance).deploy(
      pancakeRouter.address,
    );
  });

  test("Should be deployed with сorrect PancakeSwap router address", async () => {
    expect(await harvester.pancakeRouter()).toBe(pancakeRouter.address);
  });

  test("Should sweep all tokens", async () => {
    const amount = ethers.utils.parseUnits("100", await cake.decimals());
    await cake.transfer(harvester.address, amount);

    await harvester.sweep(cake.address);
    expect(await cake.balanceOf(harvester.address)).toStrictEqual(
      ethers.constants.Zero,
    );
    expect(await cake.balanceOf(governance.address)).toStrictEqual(amount);
  });
});
