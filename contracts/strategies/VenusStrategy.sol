// SPDX-License-Identifier: AGPL-3.0

pragma solidity 0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "./../interfaces/IPancakeRouter.sol";
import {IVault} from "./../Vault.sol";
import "./IStrategy.sol";

interface IUnitroller {
    function enterMarkets(address[] calldata vTokens) external returns (uint256[] memory);

    function claimVenus(address account, address[] calldata vTokens) external;
}

interface IVToken is IERC20Metadata {
    function mint(uint256 amount) external returns (uint256);

    function redeem(uint256 amount) external returns (uint256);

    function redeemUnderlying(uint256 amount) external returns (uint256);

    function underlying() external view returns (address);

    function balanceOfUnderlying(address account) external returns (uint256);

    function exchangeRateCurrent() external returns (uint256);

    function supplyRatePerBlock() external returns (uint256);
}

contract VenusStrategy is Ownable, IStrategy {
    using Math for uint256;
    using SafeERC20 for IERC20Metadata;

    IPancakeRouter public pancakeRouter;
    IVault public vault;
    IVToken public vToken;
    IUnitroller public unitroller;
    IERC20Metadata public underlying;
    IERC20Metadata public xvs;
    address public strategist;
    uint256 public immutable minWithdrawalCap;
    uint256 public withdrawalCap = type(uint256).max;
    address[] public xvsToUnderlyingPath;
    bool public reinvestXvs;

    modifier onlyStrategist {
        require(
            _msgSender() == strategist || _msgSender() == owner(),
            "VenusStrategy: only strategist or timelock allowed"
        );
        _;
    }

    modifier onlyVault {
        require(_msgSender() == address(vault), "VenusStrategy: only vault allowed");
        _;
    }

    constructor(
        IVault _vault,
        IVToken _vToken,
        IUnitroller _unitroller,
        IERC20Metadata _xvs,
        address _timelock,
        IPancakeRouter _pancakeRouter,
        address[] memory _xvsToUnderlyingPath,
        bool _reinvestXvs
    ) {
        require(_xvsToUnderlyingPath.length >= 2, "VenusStrategy: path length must be >= 2");
        xvsToUnderlyingPath = _xvsToUnderlyingPath;
        reinvestXvs = _reinvestXvs;
        strategist = _msgSender();
        vault = _vault;
        vToken = _vToken;
        xvs = _xvs;
        pancakeRouter = _pancakeRouter;
        underlying = IERC20Metadata(_vToken.underlying());
        minWithdrawalCap = 1000 * (10**underlying.decimals());
        underlying.safeIncreaseAllowance(address(_vToken), type(uint256).max);

        unitroller = _unitroller;
        address[] memory vTokens = new address[](1);
        vTokens[0] = address(_vToken);
        unitroller.enterMarkets(vTokens);

        transferOwnership(_timelock);
    }

    function invest() external override onlyVault {
        uint256 balance = underlying.balanceOf(address(this));
        require(vToken.mint(balance) == 0);
    }

    function divest(uint256 amount) external override onlyVault {
        address[] memory vTokens = new address[](1);
        vTokens[0] = address(vToken);
        unitroller.claimVenus(address(this), vTokens);
        uint256 balance = xvs.balanceOf(address(this));
        if (balance > 0) {
            xvs.approve(address(pancakeRouter), balance);
            balance = pancakeRouter.swapExactTokensForTokens(
                balance,
                0,
                xvsToUnderlyingPath,
                address(this),
                block.timestamp + 1800
            )[xvsToUnderlyingPath.length - 1];
            if (reinvestXvs) {
                require(vToken.mint(balance) == 0);
            }
        }

        balance = underlying.balanceOf(address(this));
        if (balance < amount) {
            uint256 missingAmount = amount - balance;
            require(missingAmount <= withdrawalCap, "VenusStrategy: reached withdrawal cap");
            vToken.redeemUnderlying(missingAmount);
        }
        balance = underlying.balanceOf(address(this));
        underlying.safeTransfer(address(vault), Math.min(amount, balance));
    }

    function rescue(
        IERC20Metadata token,
        address to,
        uint256 amount
    ) external onlyOwner {
        token.safeTransfer(to, amount);
    }

    function depositUnderlying(uint256 amount) external onlyStrategist {
        vToken.mint(amount);
    }

    function depositAll() external onlyStrategist {
        vToken.mint(underlying.balanceOf(address(this)));
    }

    function withdrawShares(uint256 shares) external onlyStrategist {
        vToken.redeem(shares);
    }

    function withdrawUnderlying(uint256 amount) public onlyStrategist {
        vToken.redeemUnderlying(amount);
    }

    function withdrawAll() external onlyStrategist {
        vToken.redeem(vToken.balanceOf(address(this)));
    }

    function setWithdrawalCap(uint256 underlyingCap) external onlyOwner {
        require(underlyingCap >= minWithdrawalCap, "VenusStrategy: withdrawal cap too low");
        withdrawalCap = underlyingCap;
    }

    function setStrategist(address _strategist) external onlyOwner {
        require(_strategist != address(0), "Strategy: strategist can't be zero address");
        strategist = _strategist;
    }

    function calcTotalValue() external override returns (uint256) {
        return totalVenusDeposits();
    }

    function totalVenusDeposits() public returns (uint256) {
        return vToken.balanceOfUnderlying(address(this));
    }
}
