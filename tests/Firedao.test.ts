import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  IERC20Metadata as ERC20,
  IERC20Metadata__factory as ERC20Factory,
  IPancakeRouter__factory as PancakeRouterFactory,
  IPancakeRouter as PancakeRouter,
  IVToken__factory as VTokenFactory,
  IVToken as VToken,
  FIRE__factory as FireFactory,
  FIRE as Fire,
  Harvester,
  Harvester__factory as HarversterFactory,
  Vault__factory as VaultFactory,
  Vault,
  VenusStrategy__factory as VenusStrategyFactory,
  VenusStrategy,
} from "./../typechain";
import {
  WHALE_ADDRESS,
  DAI_ADDRESS,
  CAKE_ADDRESS,
  PANCAKE_ROUTER_ADDRESS,
  XVS_ADDRESS,
  V_DAI_ADDRESS,
  UNITROLLER_ADDRESS,
  WBNB_ADDRESS,
  impersonate,
} from "./helpers";
import { BigNumber } from "@ethersproject/bignumber";

describe("FIREDAO", () => {
  let amount: BigNumber;
  let governance: SignerWithAddress,
    timelock: SignerWithAddress,
    treasury: SignerWithAddress,
    whale: SignerWithAddress;
  let dai: ERC20, cake: ERC20, xvs: ERC20, vDai: VToken;
  let fire: Fire;
  let pancakeRouter: PancakeRouter;
  let harvester: Harvester;
  let vault: Vault;
  let strategy: VenusStrategy;

  beforeAll(async () => {
    [governance, timelock, treasury] = await ethers.getSigners();

    whale = await impersonate(WHALE_ADDRESS);

    dai = ERC20Factory.connect(DAI_ADDRESS, whale);
    cake = ERC20Factory.connect(CAKE_ADDRESS, whale);
    xvs = ERC20Factory.connect(XVS_ADDRESS, governance);
    vDai = VTokenFactory.connect(V_DAI_ADDRESS, whale);

    pancakeRouter = PancakeRouterFactory.connect(
      PANCAKE_ROUTER_ADDRESS,
      governance,
    );

    amount = ethers.utils.parseUnits("100", await dai.decimals());
  });

  test("deploy FIRE and create pool", async () => {
    fire = await new FireFactory(whale).deploy(whale.address);
    await fire.approve(pancakeRouter.address, amount);
    await cake.approve(pancakeRouter.address, amount);

    const currentBlock = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(currentBlock);
    const future = block.timestamp + 178800;
    await pancakeRouter
      .connect(whale)
      .addLiquidity(
        fire.address,
        cake.address,
        amount,
        amount,
        0,
        0,
        whale.address,
        future,
      );
  });

  test("should deploy Harvester", async () => {
    harvester = await new HarversterFactory(governance).deploy(
      pancakeRouter.address,
      treasury.address,
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
    strategy = await new VenusStrategyFactory(governance).deploy(
      vault.address,
      vDai.address,
      UNITROLLER_ADDRESS,
      xvs.address,
      timelock.address,
      pancakeRouter.address,
      [xvs.address, WBNB_ADDRESS, dai.address],
    );
    expect(await strategy.strategist()).toBe(governance.address);
    expect(await strategy.vault()).toBe(vault.address);
    expect(await strategy.vToken()).toBe(vDai.address);
    expect(await strategy.underlying()).toBe(dai.address);
    expect(await strategy.unitroller()).toBe(UNITROLLER_ADDRESS);
    expect(await strategy.xvs()).toBe(xvs.address);
    expect(await strategy.pancakeRouter()).toBe(pancakeRouter.address);
    expect(await strategy.owner()).toBe(timelock.address);
  });

  test("should connect Venus Strategy to Vault", async () => {
    await vault.setStrategy(strategy.address, false);
    expect(await vault.strategy()).toBe(strategy.address);
    expect(await vault.paused()).toBe(false);
  });

  test("should deposit", async () => {
    await dai.approve(vault.address, amount);
    await vault.connect(whale).deposit(amount);
    expect(await dai.balanceOf(vault.address)).toStrictEqual(amount);
    expect(await vault.balanceOf(whale.address)).toStrictEqual(amount);
  });

  test("should earn", async () => {
    await vault.earn();
    const balance = await dai.balanceOf(vault.address);
    expect(balance).toStrictEqual(amount.mul(1000).div(10000));
  });

  test("should harvest", async () => {
    const currentBlock = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(currentBlock);
    const future = block.timestamp + 178800;
    await network.provider.request({
      method: "evm_setNextBlockTimestamp",
      params: [future],
    });

    await vault.underlyingYield();
    const y = await vault.callStatic.underlyingYield();
    expect(y.gt(0)).toBe(true);

    await harvester.harvestVault(
      vault.address,
      y,
      0,
      [dai.address, cake.address],
      [cake.address, fire.address],
      future + 10,
    );
    const balance = await cake.balanceOf(vault.address);
    expect(balance.gt(0)).toBe(true);
  });

  test("should claim target token", async () => {
    const balanceBefore = await cake.balanceOf(whale.address);

    const unclaimedProfit = await vault.unclaimedProfit(whale.address);
    expect(unclaimedProfit.gt(0)).toBe(true);
    await vault.connect(whale).claim();

    const balanceAfter = await cake.balanceOf(whale.address);
    expect(balanceAfter.sub(balanceBefore)).toStrictEqual(unclaimedProfit);
  });

  test("should withdraw underlying token", async () => {
    const balanceBefore = await dai.balanceOf(whale.address);

    await vault.connect(whale).withdraw(amount);

    const balanceAfter = await dai.balanceOf(whale.address);
    expect(balanceAfter.sub(balanceBefore)).toStrictEqual(amount);
  });
});
