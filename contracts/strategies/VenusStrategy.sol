// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./../interfaces/IERC20Metadata.sol";
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

    function balanceOfUnderlying(address account) external view returns (uint256);
}

contract VenusStrategy is Ownable, IStrategy {
    using SafeERC20 for IERC20Metadata;

    uint256 internal constant MAX_UINT256 = 2**256 - 1;

    IVault public vault;
    IVToken public vToken;
    IUnitroller public unitroller;
    IERC20Metadata public underlying;
    address public strategist;
    uint256 public buffer;
    uint256 public immutable minWithdrawalCap;
    uint256 public withdrawalCap = MAX_UINT256;

    modifier onlyStrategist {
        require(_msgSender() == strategist || _msgSender() == owner(), "Strategy: only strategist or timelock allowed");
        _;
    }

    modifier onlyVault {
        require(_msgSender() == address(vault), "Strategy: only vault allowed");
        _;
    }

    constructor(
        IVault _vault,
        IVToken _vToken,
        IUnitroller _unitroller,
        address _timelock
    ) {
        strategist = _msgSender();
        vault = _vault;
        vToken = _vToken;
        underlying = IERC20Metadata(_vToken.underlying());
        minWithdrawalCap = 1000 * (10**underlying.decimals());
        underlying.safeIncreaseAllowance(address(_vToken), MAX_UINT256);

        unitroller = _unitroller;
        address[] memory vTokens = new address[](1);
        vTokens[0] = address(_vToken);
        unitroller.enterMarkets(vTokens);

        transferOwnership(_timelock);
    }

    function invest() external override onlyVault {
        uint256 balance = underlying.balanceOf(address(this));
        // TODO: Move buffer to Vault
        if (balance > buffer) {
            vToken.mint(balance - buffer);
        }
    }

    function divest(uint256 amount) external override onlyVault {
        address[] memory vTokens = new address[](1);
        vTokens[0] = address(vToken);
        unitroller.claimVenus(address(this), vTokens);

        uint256 balance = underlying.balanceOf(address(this));
        if (balance < amount) {
            uint256 missingAmount = amount - balance;
            require(missingAmount <= withdrawalCap, "VenusStrategy: reached withdrawal cap");
            vToken.redeemUnderlying(missingAmount);
        }
        underlying.safeTransfer(address(vault), amount);
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

    function setBuffer(uint256 _buffer) external onlyOwner {
        buffer = _buffer;
    }

    function setWithdrawalCap(uint256 underlyingCap) external onlyOwner {
        require(underlyingCap >= minWithdrawalCap, "VenusStrategy: withdrawal cap too low");
        withdrawalCap = underlyingCap;
    }

    function setStrategist(address _strategist) external onlyOwner {
        require(_strategist != address(0), "Strategy: strategist can't be zero address");
        strategist = _strategist;
    }

    function calcTotalValue() external view override returns (uint256) {}

    function totalVenusDeposits() public view returns (uint256) {
        return vToken.balanceOf(address(this));
    }

    function sharesForAmount(uint256 amount) internal view returns (uint256) {}
}
