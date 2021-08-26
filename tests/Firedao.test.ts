import { ethers, network } from "hardhat";
import { expect } from "chai";
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
  Farm__factory,
  Farm,
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
  FIRE_BUSD_LP_TOKEN_ADDRESS,
} from "./helpers";
import { BigNumber } from "@ethersproject/bignumber";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";

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
  let farm: Farm;
  let vault: Vault;
  let strategy: VenusStrategy;

  before(async () => {
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

  it("create FIRE/CAKE pool", async () => {
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

  it("should deploy Harvester", async () => {
    harvester = await new HarversterFactory(governance).deploy(
      pancakeRouter.address,
      treasury.address,
    );
    expect(await harvester.pancakeRouter()).to.be.equal(pancakeRouter.address);
  });

  it("should deploy Farm", async () => {
    farm = await new Farm__factory(governance).deploy(
      fire.address,
      FIRE_BUSD_LP_TOKEN_ADDRESS,
    );
    await fire.setOwner(farm.address);
    expect(await farm.fire()).to.be.equal(fire.address);
  });

  it("should deploy DAI->CAKE Vault with сorrect name, symbol, and addresses", async () => {
    vault = await new VaultFactory(governance).deploy(
      dai.address,
      cake.address,
      harvester.address,
      timelock.address,
      farm.address,
    );

    await farm.addPool(dai.address, 25);
    await farm.addVault(vault.address);

    const daiSymbol = await dai.symbol();
    const cakeSymbol = await cake.symbol();
    expect(await vault.name()).to.be.equal(
      `FIREDAO ${daiSymbol} to ${cakeSymbol} Yield Token`,
    );
    expect(await vault.symbol()).to.be.equal(`fi${daiSymbol}->${cakeSymbol}`);

    expect(await vault.harvester()).to.be.equal(harvester.address);
    expect(await vault.underlying()).to.be.equal(dai.address);
    expect(await vault.target()).to.be.equal(cake.address);
    expect(await vault.timelock()).to.be.equal(timelock.address);
    expect(await vault.paused()).to.be.true;
  });

  it("should deploy Venus Strategy", async () => {
    strategy = await new VenusStrategyFactory(governance).deploy(
      vault.address,
      vDai.address,
      UNITROLLER_ADDRESS,
      xvs.address,
      timelock.address,
      pancakeRouter.address,
      [xvs.address, WBNB_ADDRESS, dai.address],
      true,
    );
    expect(await strategy.strategist()).to.be.equal(governance.address);
    expect(await strategy.vault()).to.be.equal(vault.address);
    expect(await strategy.vToken()).to.be.equal(vDai.address);
    expect(await strategy.underlying()).to.be.equal(dai.address);
    expect(await strategy.unitroller()).to.be.equal(UNITROLLER_ADDRESS);
    expect(await strategy.xvs()).to.be.equal(xvs.address);
    expect(await strategy.pancakeRouter()).to.be.equal(pancakeRouter.address);
    expect(await strategy.owner()).to.be.equal(timelock.address);
    expect(await strategy.reinvestXvs()).to.be.true;
  });

  it("should connect Venus Strategy to Vault", async () => {
    await vault.setStrategy(strategy.address, false);
    expect(await vault.strategy()).to.be.equal(strategy.address);
    expect(await vault.paused()).to.be.false;
  });

  it("should deposit DAI", async () => {
    await dai.approve(vault.address, daiAmount);
    await vault.connect(whale).deposit(daiAmount);
    expect(await dai.balanceOf(vault.address)).to.deep.equal(daiAmount);
    expect(await vault.balanceOf(whale.address)).to.deep.equal(daiAmount);

    const { sharesTotal } = await farm.pools(dai.address);
    const { shares } = await farm.users(dai.address, whale.address);
    expect(sharesTotal).to.deep.equal(daiAmount);
    expect(shares).to.deep.equal(daiAmount);
  });

  it("should earn", async () => {
    await vault.earn();

    let balance = await dai.balanceOf(vault.address);
    const barrier = await vault.barrier();
    expect(balance).to.deep.equal(daiAmount.mul(barrier).div(BP));
  });

  it("should harvest", async () => {
    const currentBlock = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(currentBlock);
    const future = block.timestamp + 178800;
    await network.provider.request({
      method: "evm_setNextBlockTimestamp",
      params: [future],
    });

    await vault.underlyingYield();
    const y = await vault.callStatic.underlyingYield();
    const underlyingBalance = await dai.balanceOf(vault.address);
    const venusUnderlyingBalance = await vDai.callStatic.balanceOfUnderlying(
      strategy.address,
    );
    const totalSupply = await vault.totalSupply();
    expect(y).to.deep.equal(
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
        future + 1000,
      );
    const [, fireAmount] = await pancakeRouter
      .connect(whale)
      .callStatic.swapExactTokensForTokens(
        cakeAmount.mul(fireBuyBack).div(BP),
        0,
        [cake.address, fire.address],
        harvester.address,
        future + 1000,
      );

    await harvester.harvestVault(
      vault.address,
      y,
      0,
      [dai.address, cake.address],
      [cake.address, fire.address],
      future + 1000,
    );

    let balance = await cake.balanceOf(treasury.address);
    const performanceFee = await harvester.performanceFee();
    expect(balance).to.deep.equal(cakeAmount.mul(performanceFee).div(BP));

    balance = await fire.balanceOf(harvester.address);
    expect(balance).to.deep.equal(fireAmount);
  });

  it("should claim CAKE", async () => {
    const balance = await cake.balanceOf(vault.address);
    const balanceBefore = await cake.balanceOf(whale.address);

    const unclaimedProfit = await vault.unclaimedProfit(whale.address);
    expect(unclaimedProfit).to.deep.equal(balance.sub(1));
    await vault.connect(whale).claim();

    const balanceAfter = await cake.balanceOf(whale.address);
    expect(balanceAfter.sub(balanceBefore)).to.deep.equal(unclaimedProfit);
  });

  it("should withdraw DAI", async () => {
    const balanceBefore = await dai.balanceOf(whale.address);

    await vault.connect(whale).withdraw(daiAmount);

    const balanceAfter = await dai.balanceOf(whale.address);
    const withdrawalFee = await vault.withdrawalFee();
    expect(balanceAfter.sub(balanceBefore)).to.deep.equal(
      daiAmount.sub(daiAmount.mul(withdrawalFee).div(BP)),
    );

    const { sharesTotal } = await farm.pools(dai.address);
    const { shares } = await farm.users(dai.address, whale.address);
    expect(sharesTotal).to.deep.equal(ethers.constants.Zero);
    expect(shares).to.deep.equal(ethers.constants.Zero);
  });
});
