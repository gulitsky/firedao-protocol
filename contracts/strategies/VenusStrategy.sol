// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./../interfaces/IERC20Metadata.sol";
import {IVault} from "./../Vault.sol";
import "./IStrategy.sol";

interface IUnitroller {
    function enterMarkets(address[] calldata vTokens) external returns (uint256[] memory);

    function claimVenus(address account) external;
}

interface IVToken is IERC20Metadata {
    function mint(uint256 amount) external returns (uint256);

    function underlying() external view returns (address);
}

contract VenusStrategy is Ownable, IStrategy {
    using SafeERC20 for IERC20Metadata;

    uint256 internal constant MAX_UINT256 = 2**256 - 1;

    IVault public vault;
    IVToken public vToken;
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
        address _timelock
    ) {
        strategist = _msgSender();
        vault = _vault;
        vToken = _vToken;
        underlying = IERC20Metadata(_vToken.underlying());
        minWithdrawalCap = 1000 * (10**underlying.decimals());
        underlying.safeIncreaseAllowance(address(_vToken), MAX_UINT256);
        transferOwnership(_timelock);
    }

    function invest() external override onlyVault {
        uint256 balance = underlying.balanceOf(address(this));
        if (balance > buffer) {
            vToken.mint(balance - buffer);
        }
    }

    function divest(uint256 amount) external override onlyVault {
        uint256 balance = underlying.balanceOf(address(this));
        if (balance < amount) {
            uint256 missingAmount = amount - balance;
            require(missingAmount <= withdrawalCap, "VenusStrategy: reached withdrawal cap");
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

    function setStrategist(address _strategist) external onlyOwner {
        require(_strategist != address(0), "Strategy: strategist can't be zero address");
        strategist = _strategist;
    }

    function totalVenusDeposits() public view returns (uint256) {
        return vToken.balanceOf(address(this));
    }

    function calcTotalValue() external view override returns (uint256) {}
}
