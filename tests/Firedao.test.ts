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
  advanceBlocks,
  BLOCKS_PER_DAY,
} from "./helpers";
import { BigNumber } from "@ethersproject/bignumber";

const BP = ethers.BigNumber.from(10000);

describe("FIREDAO", () => {
  let daiAmount: BigNumber;
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
  let supplyRate: BigNumber;

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

    fire = await new FireFactory(whale).deploy(whale.address);
    await fire.openTheGates();

    daiAmount = ethers.utils.parseUnits("100", await dai.decimals());
  });

  test("create FIRE/CAKE pool", async () => {
    const fireAmount = await fire.balanceOf(whale.address);
    await fire.connect(whale).approve(pancakeRouter.address, fireAmount);
    const daiBalance = await dai.balanceOf(whale.address);
    await dai.approve(pancakeRouter.address, daiBalance);
    const cakeAmount = await cake.balanceOf(whale.address);
    await cake.approve(pancakeRouter.address, cakeAmount);

    const currentBlock = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(currentBlock);
    const future = block.timestamp + 178800;
    await pancakeRouter
      .connect(whale)
      .addLiquidity(
        fire.address,
        cake.address,
        fireAmount,
        cakeAmount.div(2),
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

  test("should deploy DAI->CAKE Vault with сorrect name, symbol, and addresses", async () => {
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

  test("should deposit DAI", async () => {
    await dai.approve(vault.address, daiAmount);
    await vault.connect(whale).deposit(daiAmount);
    expect(await dai.balanceOf(vault.address)).toStrictEqual(daiAmount);
    expect(await vault.balanceOf(whale.address)).toStrictEqual(daiAmount);
  });

  test("should earn", async () => {
    await vault.earn();
    supplyRate = await vDai.callStatic.supplyRatePerBlock();

    let balance = await dai.balanceOf(vault.address);
    const barrier = await vault.barrier();
    expect(balance).toStrictEqual(daiAmount.mul(barrier).div(BP));
  });

  test("should harvest", async () => {
    await advanceBlocks(BLOCKS_PER_DAY);
    const block = await ethers.provider.getBlock("latest");
    const future = block.timestamp + 90;

    await vault.underlyingYield();
    const y = await vault.callStatic.underlyingYield();
    const underlyingBalance = await dai.balanceOf(vault.address);
    const venusUnderlyingBalance = await vDai.callStatic.balanceOfUnderlying(
      strategy.address,
    );
    const totalSupply = await vault.totalSupply();
    expect(y).toStrictEqual(
      venusUnderlyingBalance.add(underlyingBalance).sub(totalSupply),
    );

    const fireBuyBack = await harvester.fireBuyBack();
    const [, cakeAmount] = await pancakeRouter
      .connect(whale)
      .callStatic.swapExactTokensForTokens(
        y,
        0,
        [dai.address, cake.address],
        harvester.address,
        future,
      );
    const [, fireAmount] = await pancakeRouter
      .connect(whale)
      .callStatic.swapExactTokensForTokens(
        cakeAmount.mul(fireBuyBack).div(BP),
        0,
        [cake.address, fire.address],
        harvester.address,
        future,
      );

    await harvester.harvestVault(
      vault.address,
      y,
      0,
      [dai.address, cake.address],
      [cake.address, fire.address],
      future + 10,
    );

    let balance = await cake.balanceOf(treasury.address);
    const performanceFee = await harvester.performanceFee();
    expect(balance).toStrictEqual(cakeAmount.mul(performanceFee).div(BP));

    balance = await fire.balanceOf(harvester.address);
    expect(balance).toStrictEqual(fireAmount);
  });

  test("should claim CAKE", async () => {
    const balance = await cake.balanceOf(vault.address);
    const balanceBefore = await cake.balanceOf(whale.address);

    const unclaimedProfit = await vault.unclaimedProfit(whale.address);
    expect(unclaimedProfit).toStrictEqual(balance.sub(1));
    await vault.connect(whale).claim();

    const balanceAfter = await cake.balanceOf(whale.address);
    expect(balanceAfter.sub(balanceBefore)).toStrictEqual(unclaimedProfit);
  });

  test("should withdraw DAI", async () => {
    const balanceBefore = await dai.balanceOf(whale.address);

    await vault.connect(whale).withdraw(daiAmount);

    const balanceAfter = await dai.balanceOf(whale.address);
    expect(balanceAfter.sub(balanceBefore)).toStrictEqual(daiAmount);
  });
});
