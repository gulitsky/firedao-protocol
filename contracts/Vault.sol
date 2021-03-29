// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IERC20Metadata.sol";
import {IHarvester} from "./Harvester.sol";
import "./DividendToken.sol";
import "./strategies/IStrategy.sol";

interface IVault is IDividendToken {
    function deposit(uint256) external;

    function claim() external;

    function withdraw(uint256 amount) external;

    function harvest(uint256 amount) external returns (uint256 afterFee);

    function distributeDividends(uint256 amount) external;

    function underlying() external view returns (IERC20Metadata);

    function target() external view returns (IERC20Metadata);

    function lastDistributionAt() external view returns (uint256);
}

contract Vault is Ownable, Pausable, IVault, DividendToken {
    using SafeERC20 for IERC20Metadata;

    uint256 internal constant MAX_FEE = 10000;

    IHarvester public harvester;
    address public timelock;
    IStrategy public strategy;

    IERC20Metadata public immutable override underlying;

    uint256 public depositLimit;
    uint256 public performanceFee;
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
            } else {
                require(_msgSender() == owner(), "Vault: only gov allowed");
                _unpause();
            }
            strategy = _strategy;
        }
    }

    function setHarvester(IHarvester _harvester) external onlyOwner {
        harvester = _harvester;
    }

    function setDepositLimit(uint256 _depositLimit) external onlyOwner {
        depositLimit = _depositLimit;
    }

    function setPerformanceFee(uint256 _performanceFee) external onlyOwner {
        require(_performanceFee <= MAX_FEE, "Vault: performance fee too high");
        performanceFee = _performanceFee;
    }

    function deposit(uint256 amount) external override {
        if (depositLimit > 0) {
            require(totalSupply() + amount <= depositLimit, "Vault: total supply will exceed deposit limit");
        }
        underlying.safeTransferFrom(_msgSender(), address(strategy), amount);
        strategy.invest();
        _mint(_msgSender(), amount);
    }

    function claim() external override {
        withdrawDividend(_msgSender());
    }

    function claimOnBehalf(address account) external {
        require(_msgSender() == harvester || _msgSender() == owner(), "Vault: only harvester or gov allowed");
        withdrawDividend(account);
    }

    function withdraw(uint256 amount) external override {
        _burn(_msgSender(), amount);
        // TODO: Not divest when underlying balance is sufficent to cover withdraw amount
        strategy.divest(amount);
        underlying.safeTransfer(_msgSender(), amount);
    }

    function harvest(uint256 amount) external override onlyHarvester returns (uint256 afterFee) {
        // require(amount <= underlyingYield(), "Vault: amount larger than generated yield");
        strategy.divest(amount);
        if (performanceFee > 0) {
            uint256 fee = (amount * performanceFee) / MAX_FEE;
            afterFee = amount - fee;
            underlying.safeTransfer(owner(), fee);
        } else {
            afterFee = amount;
        }
        underlying.safeTransfer(address(harvester), afterFee);
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

    function calcTotalValue() public view returns (uint256) {
        return strategy.calcTotalValue();
    }

    function underlyingYield() public view returns (uint256) {
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
