// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IERC20Metadata.sol";
import {IHarvester} from "./Harvester.sol";
import "./DividendToken.sol";
import "./strategies/IStrategy.sol";

interface IVault {
    function deposit(uint256) external;

    function claim() external;

    function withdraw(uint256 amount) external;

    function harvest(uint256 amount) external returns (uint256);

    // function underlying() external view returns (address);

    // function target() external view returns (address);

    function lastDistributionAt() external view returns (uint256);
}

contract Vault is Ownable, IVault, DividendToken {
    using SafeERC20 for IERC20Metadata;

    IHarvester public harvester;
    IStrategy public strategy;

    IERC20Metadata public immutable underlying;

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
        IHarvester _harvester
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
    }

    function deposit(uint256 amount) public override {
        if (depositLimit > 0) {
            require(totalSupply() + amount <= depositLimit, "Vault: total supply will exceed deposit limit");
        }
        underlying.safeTransferFrom(_msgSender(), address(strategy), amount);
        strategy.invest();
        _mint(_msgSender(), amount);
    }

    function claim() public override {
        withdrawDividend(_msgSender());
    }

    function withdraw(uint256 amount) public override {
        _burn(_msgSender(), amount);
        // TODO: Not divest when underlying balance is sufficent to cover withdraw amount
        strategy.divest(amount);
        underlying.safeTransfer(_msgSender(), amount);
    }

    function harvest(uint256 amount) public override onlyHarvester returns (uint256) {
        strategy.divest(amount);
        /*
        if (performanceFee >0) {

        } else {

        }
        underlying.safeTransfer(harvester, )
        */
    }

    function distributeDividends(uint256 amount) public onlyHarvester {
        _distributeDividends(amount);
        lastDistributionAt = block.timestamp;
    }

    function decimals() public view override returns (uint8) {
        return underlyingDecimals;
    }
}
