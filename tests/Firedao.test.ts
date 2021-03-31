import { ethers, network } from "hardhat";
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
  VenusStrategy__factory as VenusStrategyFactory,
  VenusStrategy,
} from "./../typechain";

const WHALE_ADDRESS = "0x46b513dD578D7BBc1D86c45c9A6CC687C942704B";
const DAI_ADDRESS = "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3";
const CAKE_ADDRESS = "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82";
const PANCAKE_ROUTER_ADDRESS = "0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F";
const V_DAI_ADDRESS = "0x334b3eCB4DCa3593BCCC3c7EBD1A1C1d1780FBF1";
const UNITROLLER_ADDRESS = "0xfD36E2c2a6789Db23113685031d7F16329158384";

describe("FIREDAO", () => {
  let governance: SignerWithAddress,
    timelock: SignerWithAddress,
    whale: SignerWithAddress;
  let dai: ERC20, cake: ERC20, vDai: ERC20;
  let pancakeRouter: PancakeRouter;
  let harvester: Harvester;
  let vault: Vault;
  let venusStrategy: VenusStrategy;

  beforeAll(async () => {
    [governance, timelock] = await ethers.getSigners();

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [WHALE_ADDRESS],
    });
    whale = await ethers.getSigner(WHALE_ADDRESS);

    dai = ERC20Factory.connect(DAI_ADDRESS, whale);
    cake = ERC20Factory.connect(CAKE_ADDRESS, whale);
    vDai = ERC20Factory.connect(V_DAI_ADDRESS, whale);

    pancakeRouter = PancakeRouterFactory.connect(
      PANCAKE_ROUTER_ADDRESS,
      governance,
    );
  });

  test("should deploy Harvester", async () => {
    harvester = await new HarversterFactory(governance).deploy(
      pancakeRouter.address,
    );
    expect(await harvester.pancakeRouter()).toBe(pancakeRouter.address);
  });

  test("should deploy Vault with сorrect name, symbol, and addresses", async () => {
    vault = await new VaultFactory(governance).deploy(
      dai.address,
      cake.address,
      harvester.address,
      timelock.address,
    );

    const daiSymbol = await dai.symbol();
    const cakeSymbol = await cake.symbol();
    expect(await vault.name()).toBe(
      `FIREDAO ${daiSymbol} to ${cakeSymbol} Yield Token`,
    );
    expect(await vault.symbol()).toBe(`fi${daiSymbol}->${cakeSymbol}`);

    expect(await vault.harvester()).toBe(harvester.address);
    expect(await vault.underlying()).toBe(dai.address);
    expect(await vault.target()).toBe(cake.address);
    expect(await vault.timelock()).toBe(timelock.address);

    expect(await vault.paused()).toBe(true);
  });

  test("should deploy Venus Strategy", async () => {
    venusStrategy = await new VenusStrategyFactory(governance).deploy(
      vault.address,
      vDai.address,
      UNITROLLER_ADDRESS,
      timelock.address,
    );
    expect(await venusStrategy.strategist()).toBe(governance.address);
    expect(await venusStrategy.vault()).toBe(vault.address);
    expect(await venusStrategy.vToken()).toBe(vDai.address);
    expect(await venusStrategy.underlying()).toBe(dai.address);
    expect(await venusStrategy.unitroller()).toBe(UNITROLLER_ADDRESS);
  });

  test("should connect Venus Strategy to Vault", async () => {
    await vault.setStrategy(venusStrategy.address, false);
    expect(await vault.strategy()).toBe(venusStrategy.address);
    expect(await vault.paused()).toBe(false);
  });

  test("should deposit", async () => {
    const amount = ethers.utils.parseUnits("100", await cake.decimals());
    await dai.approve(vault.address, amount);
    await vault.connect(whale).deposit(amount);
    expect(await vault.balanceOf(whale.address)).toStrictEqual(amount);
  });
});
