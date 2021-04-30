// SPDX-License-Identifier: AGPL-3.0

pragma solidity 0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IPancakeRouter.sol";
import {IHarvester} from "./Harvester.sol";
import "./DividendToken.sol";
import "./strategies/IStrategy.sol";

interface IVault is IDividendToken {
    function deposit(uint256) external;

    function earn() external;

    function claim() external;

    function withdraw(uint256 amount) external;

    function harvest(uint256 amount) external;

    function distributeDividends(uint256 amount) external;

    function underlying() external view returns (IERC20Metadata);

    function target() external view returns (IERC20Metadata);

    function lastDistributionAt() external view returns (uint256);
}

contract Vault is Ownable, Pausable, IVault, DividendToken {
    using SafeERC20 for IERC20Metadata;

    uint256 internal constant BP = 10000; // 100 %

    IHarvester public harvester;
    address public timelock;
    IStrategy public strategy;

    IERC20Metadata public immutable override underlying;

    uint256 public barrier = 1000; // 10 %
    uint256 public depositLimit;
    uint256 public override lastDistributionAt;

    uint8 internal immutable underlyingDecimals;

    modifier onlyHarvester {
        require(_msgSender() == address(harvester), "Vault: only harvester allowed");
        _;
    }

    constructor(
        IERC20Metadata _underlying,
        IERC20Metadata _target,
        IHarvester _harvester,
        address _timelock
    )
        DividendToken(
            string(abi.encodePacked("FIREDAO ", _underlying.symbol(), " to ", _target.symbol(), " Yield Token")),
            string(abi.encodePacked("fi", _underlying.symbol(), "->", _target.symbol())),
            _target
        )
    {
        underlying = _underlying;
        underlyingDecimals = _underlying.decimals();
        harvester = _harvester;
        timelock = _timelock;
        depositLimit = 20000 * (10**_underlying.decimals());
        _pause();
    }

    function setStrategy(IStrategy _strategy, bool force) external {
        if (address(strategy) != address(0)) {
            require(_msgSender() == timelock, "Vault: only timelock allowed");
            uint256 prevTotalValue = strategy.calcTotalValue();
            strategy.divest(prevTotalValue);
            underlying.safeTransfer(address(_strategy), underlying.balanceOf(address(this)));
            _strategy.invest();
            if (!force) {
                require(_strategy.calcTotalValue() >= prevTotalValue && strategy.calcTotalValue() == 0);
            }
        } else {
            require(_msgSender() == owner(), "Vault: only gov allowed");
            _unpause();
        }
        strategy = _strategy;
    }

    function setHarvester(IHarvester _harvester) external onlyOwner {
        harvester = _harvester;
    }

    function setDepositLimit(uint256 _depositLimit) external onlyOwner {
        depositLimit = _depositLimit;
    }

    function setBarrier(uint256 _barrier) external onlyOwner {
        require(_barrier < BP, "Vault: barrier too high");
        barrier = _barrier;
    }

    function deposit(uint256 amount) external override {
        if (depositLimit > 0) {
            require(totalSupply() + amount <= depositLimit, "Vault: total supply will exceed deposit limit");
        }
        underlying.safeTransferFrom(_msgSender(), address(this), amount);
        _mint(_msgSender(), amount);
    }

    function earn() external override onlyOwner {
        uint256 balance = underlying.balanceOf(address(this));
        uint256 amount = balance - ((balance * barrier) / BP);
        underlying.safeTransfer(address(strategy), amount);
        strategy.invest();
    }

    function claim() external override {
        withdrawDividend(_msgSender());
    }

    function claimOnBehalf(address account) external {
        require(_msgSender() == address(harvester) || _msgSender() == owner(), "Vault: only harvester or gov allowed");
        withdrawDividend(account);
    }

    function withdraw(uint256 amount) external override {
        _burn(_msgSender(), amount);
        uint256 balance = underlying.balanceOf(address(this));
        if (amount > balance) {
            strategy.divest(amount - balance);
        }
        underlying.safeTransfer(_msgSender(), amount);
    }

    function harvest(uint256 amount) external override onlyHarvester {
        require(amount <= underlyingYield(), "Vault: amount larger than generated yield");
        strategy.divest(amount);
        underlying.safeTransfer(address(harvester), amount);
    }

    function distributeDividends(uint256 amount) external override onlyHarvester {
        _distributeDividends(amount);
        lastDistributionAt = block.timestamp;
    }

    function pauseDeposits(bool pause) external onlyOwner {
        if (pause) {
            _pause();
        } else {
            _unpause();
        }
    }

    function sweep(IERC20Metadata token) external onlyOwner {
        require(token != target(), "Vault: sweeping of target token not allowed");
        token.safeTransfer(owner(), token.balanceOf(address(this)));
    }

    function calcTotalValue() public returns (uint256) {
        return strategy.calcTotalValue() + underlying.balanceOf(address(this));
    }

    function underlyingYield() public returns (uint256) {
        return calcTotalValue() - totalSupply();
    }

    function unclaimedProfit(address account) public view returns (uint256) {
        return withdrawableDividendOf(account);
    }

    function decimals() public view override returns (uint8) {
        return underlyingDecimals;
    }

    function target() public view override returns (IERC20Metadata) {
        return targetToken;
    }
}

contract DirectVault is Vault {
    constructor(
        IERC20Metadata _underlying,
        IHarvester _harvester,
        address _timelock
    ) Vault(_underlying, _underlying, _harvester, _timelock) {}
}
