// SPDX-License-Identifier: AGPL-3.0

pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "./../interfaces/IPancakeRouter.sol";
import {IVault} from "./../Vault.sol";
import "./IStrategy.sol";

interface IMasterBelt {
    function deposit(uint256 _pid, uint256 _wantAmt) external;

    function withdraw(uint256 _pid, uint256 _wantAmt) external;

    function withdrawAll(uint256 _pid) external;

    function updatePool(uint256 _pid) external;

    function stakedWantTokens(uint256 _pid, address _user) external view returns (uint256);

    function pendingBELT(uint256 _pid, address _user) external view returns (uint256);
}

contract BeltFiStrategy is Ownable, IStrategy {
    using Math for uint256;
    using SafeERC20 for IERC20Metadata;

    IPancakeRouter public pancakeRouter;
    IVault public vault;
    IMasterBelt public masterBelt;
    uint256 public pid;
    IERC20Metadata public belt;
    IERC20Metadata public underlying;
    address public strategist;
    uint256 public immutable minWithdrawalCap;
    uint256 public withdrawalCap = type(uint256).max;
    address[] public beltToUnderlyingPath;

    modifier onlyStrategist {
        require(
            _msgSender() == strategist || _msgSender() == owner(),
            "BeltFiStrategy: only strategist or timelock allowed"
        );
        _;
    }

    modifier onlyVault {
        require(_msgSender() == address(vault), "BeltFiStrategy: only vault allowed");
        _;
    }

    constructor(
        IVault _vault,
        IMasterBelt _masterBelt,
        uint256 _pid,
        IERC20Metadata _fourBelt,
        IERC20Metadata _belt,
        address _timelock,
        IPancakeRouter _pancakeRouter,
        address[] memory _beltToUnderlyingPath
    ) {
        require(_beltToUnderlyingPath.length >= 2, "BeltFiStrategy: path length must be >= 2");
        beltToUnderlyingPath = _beltToUnderlyingPath;
        underlying = _fourBelt;
        strategist = _msgSender();
        vault = _vault;
        pancakeRouter = _pancakeRouter;
        minWithdrawalCap = 1000 * (10**underlying.decimals());

        masterBelt = _masterBelt;
        pid = _pid;
        belt = _belt;
        underlying.safeIncreaseAllowance(address(masterBelt), type(uint256).max);

        transferOwnership(_timelock);
    }

    function invest() external override onlyVault {
        uint256 balance = underlying.balanceOf(address(this));
        masterBelt.deposit(pid, balance);
    }

    function divest(uint256 amount) external override onlyVault {
        farm();

        uint256 balance = underlying.balanceOf(address(this));
        if (balance < amount) {
            uint256 missingAmount = amount - balance;
            require(missingAmount <= withdrawalCap, "BeltFiStrategy: reached withdrawal cap");
            masterBelt.withdraw(pid, missingAmount);
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
        masterBelt.deposit(pid, amount);
    }

    function depositAll() external onlyStrategist {
        masterBelt.deposit(pid, underlying.balanceOf(address(this)));
    }

    function withdrawUnderlying(uint256 amount) public onlyStrategist {
        masterBelt.withdraw(pid, amount);
    }

    function withdrawAll() external onlyStrategist {
        masterBelt.withdrawAll(pid);
    }

    function setWithdrawalCap(uint256 underlyingCap) external onlyOwner {
        require(underlyingCap >= minWithdrawalCap, "BeltFiStrategy: withdrawal cap too low");
        withdrawalCap = underlyingCap;
    }

    function setStrategist(address _strategist) external onlyOwner {
        require(_strategist != address(0), "BeltFiStrategy: strategist can't be zero address");
        strategist = _strategist;
    }

    function calcTotalValue() external override returns (uint256) {
        farm();
        uint256 balance = underlying.balanceOf(address(this));
        return masterBelt.stakedWantTokens(pid, address(this)) + balance;
    }

    function farm() internal {
        masterBelt.withdraw(pid, 0);
        uint256 balance = belt.balanceOf(address(this));
        if (balance > 0) {
            belt.approve(address(pancakeRouter), balance);
            balance = pancakeRouter.swapExactTokensForTokens(
                balance,
                0,
                beltToUnderlyingPath,
                address(this),
                block.timestamp + 1800
            )[beltToUnderlyingPath.length - 1];
        }
    }
}
