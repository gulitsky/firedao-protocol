/* import { ethers, network } from "hardhat";
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
  BeltFiStrategy__factory as BeltFiStrategyFactory,
  BeltFiStrategy,
  IMasterBelt__factory as MasterBeltFactory,
  IMasterBelt as MasterBelt,
} from "./../typechain";
import {
  FOUR_BELT_WHALE,
  CAKE_ADDRESS,
  PANCAKE_ROUTER_ADDRESS,
  WBNB_ADDRESS,
  impersonate,
  BELT_ADDRESS,
  FOUR_BELT_ADDRESS,
  MASTER_BELT_ADDRESS,
  FOUR_BELT_POOL_ID,
  BUSD_T_ADDRESS,
  advanceBlock,
} from "./helpers";
import { BigNumber } from "@ethersproject/bignumber";

const BP = ethers.BigNumber.from(10000);

describe("FIREDAO", () => {
  let fourBeltAmount: BigNumber;
  let governance: SignerWithAddress,
    timelock: SignerWithAddress,
    treasury: SignerWithAddress,
    whale: SignerWithAddress;
  let belt: ERC20, cake: ERC20, fourBelt: ERC20;
  let pancakeRouter: PancakeRouter;
  let harvester: Harvester;
  let vault: Vault;
  let strategy: BeltFiStrategy;
  let masterBelt: MasterBelt;

  beforeAll(async () => {
    [governance, timelock, treasury] = await ethers.getSigners();

    whale = await impersonate(FOUR_BELT_WHALE);

    belt = ERC20Factory.connect(BELT_ADDRESS, whale);
    cake = ERC20Factory.connect(CAKE_ADDRESS, whale);
    fourBelt = ERC20Factory.connect(FOUR_BELT_ADDRESS, whale);

    pancakeRouter = PancakeRouterFactory.connect(
      PANCAKE_ROUTER_ADDRESS,
      governance,
    );

    masterBelt = MasterBeltFactory.connect(MASTER_BELT_ADDRESS, governance);

    fourBeltAmount = ethers.utils.parseUnits(
      "10000",
      await fourBelt.decimals(),
    );
  });

  test("should deploy Harvester", async () => {
    harvester = await new HarversterFactory(governance).deploy(
      pancakeRouter.address,
      treasury.address,
    );
    await harvester.setFireBuyBack(0);
    expect(await harvester.pancakeRouter()).toBe(pancakeRouter.address);
  });

  test("should deploy 4BELT->CAKE Vault with сorrect name, symbol, and addresses", async () => {
    vault = await new VaultFactory(governance).deploy(
      fourBelt.address,
      cake.address,
      harvester.address,
      timelock.address,
    );
    await vault.setWithdrawalFee(0);

    const fourBeltSymbol = await fourBelt.symbol();
    const cakeSymbol = await cake.symbol();
    expect(await vault.name()).toBe(
      `FIREDAO ${fourBeltSymbol} to ${cakeSymbol} Yield Token`,
    );
    expect(await vault.symbol()).toBe(`fi${fourBeltSymbol}->${cakeSymbol}`);

    expect(await vault.harvester()).toBe(harvester.address);
    expect(await vault.underlying()).toBe(fourBelt.address);
    expect(await vault.target()).toBe(cake.address);
    expect(await vault.timelock()).toBe(timelock.address);
    expect(await vault.paused()).toBe(true);
  });

  test("should deploy Belt Strategy", async () => {
    strategy = await new BeltFiStrategyFactory(governance).deploy(
      vault.address,
      masterBelt.address,
      FOUR_BELT_POOL_ID,
      fourBelt.address,
      belt.address,
      timelock.address,
      pancakeRouter.address,
      [belt.address, BUSD_T_ADDRESS, fourBelt.address],
    );
    expect(await strategy.strategist()).toBe(governance.address);
    expect(await strategy.vault()).toBe(vault.address);
    expect(await strategy.masterBelt()).toBe(masterBelt.address);
    expect(await strategy.underlying()).toBe(fourBelt.address);
    expect(await strategy.pid()).toStrictEqual(
      ethers.BigNumber.from(FOUR_BELT_POOL_ID),
    );
    expect(await strategy.belt()).toBe(belt.address);
    expect(await strategy.pancakeRouter()).toBe(pancakeRouter.address);
    expect(await strategy.owner()).toBe(timelock.address);
  });

  test("should connect Belt Strategy to Vault", async () => {
    await vault.setStrategy(strategy.address, false);
    expect(await vault.strategy()).toBe(strategy.address);
    expect(await vault.paused()).toBe(false);
  });

  test("should deposit 4BELT", async () => {
    await fourBelt.approve(vault.address, fourBeltAmount);
    await vault.connect(whale).deposit(fourBeltAmount);
    expect(await fourBelt.balanceOf(vault.address)).toStrictEqual(
      fourBeltAmount,
    );
    expect(await vault.balanceOf(whale.address)).toStrictEqual(fourBeltAmount);
  });

  test("should earn", async () => {
    await vault.earn();

    let balance = await fourBelt.balanceOf(vault.address);
    const barrier = await vault.barrier();
    expect(balance).toStrictEqual(fourBeltAmount.mul(barrier).div(BP));
  });

  test("should harvest", async () => {
    const currentBlock = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(currentBlock);
    const future = block.timestamp + 178800;
    await network.provider.request({
      method: "evm_setNextBlockTimestamp",
      params: [future],
    });
    await advanceBlock();

    await vault.underlyingYield();
    const y = await vault.callStatic.underlyingYield();
    const underlyingBalance = await fourBelt.balanceOf(vault.address);
    const strategyUnderlyingBalance = await fourBelt.balanceOf(
      strategy.address,
    );
    const fourBeltUnderlyingBalance = await masterBelt.stakedWantTokens(
      FOUR_BELT_POOL_ID,
      strategy.address,
    );
    const totalSupply = await vault.totalSupply();
    expect(y).toStrictEqual(
      fourBeltUnderlyingBalance
        .add(underlyingBalance)
        .add(strategyUnderlyingBalance)
        .sub(totalSupply),
    );

    const b = await fourBelt.balanceOf(whale.address);
    await fourBelt.approve(pancakeRouter.address, b);
    const [, , cakeAmount] = await pancakeRouter
      .connect(whale)
      .callStatic.swapExactTokensForTokens(
        y,
        0,
        [fourBelt.address, BUSD_T_ADDRESS, cake.address],
        harvester.address,
        future + 10000,
      );

    await harvester.harvestVault(
      vault.address,
      y,
      cakeAmount,
      [fourBelt.address, BUSD_T_ADDRESS, cake.address],
      [fourBelt.address, BUSD_T_ADDRESS, cake.address],
      future + 10000,
    );

    const treasuryBalance = await cake.balanceOf(treasury.address);
    const vaultBalance = await cake.balanceOf(vault.address);
    const balance = treasuryBalance.add(vaultBalance);
    expect(balance.gte(cakeAmount)).toBe(true);

    const performanceFee = await harvester.performanceFee();
    expect(treasuryBalance).toStrictEqual(balance.mul(performanceFee).div(BP));
  });

  test("should withdraw 4BELT", async () => {
    const balanceBefore = await fourBelt.balanceOf(whale.address);

    await vault.connect(whale).withdraw(fourBeltAmount);

    const balanceAfter = await fourBelt.balanceOf(whale.address);
    const withdrawalFee = await vault.withdrawalFee();
    expect(balanceAfter.sub(balanceBefore)).toStrictEqual(
      fourBeltAmount.sub(fourBeltAmount.mul(withdrawalFee).div(BP)),
    );
  });
});
 */
