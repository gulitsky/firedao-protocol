// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./interfaces/IERC20Metadata.sol";
import {IHarvester} from "./Harvester.sol";

interface IVault {
    function deposit(uint256) external;

    // function harvest(uint256) external;
}

contract Vault is Ownable, IVault, ERC20 {
    using SafeERC20 for IERC20;

    IHarvester public harvester;

    IERC20Metadata public immutable underlying;

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
        ERC20(
            string(abi.encodePacked("FIREDAO ", _underlying.symbol(), " to ", _target.symbol(), " Yield Token")),
            string(abi.encodePacked("fi", _underlying.symbol(), "->", _target.symbol()))
        )
    {
        underlying = _underlying;
        underlyingDecimals = _underlying.decimals();
        harvester = _harvester;
    }

    function deposit(uint256 _amount) public override {}

    function decimals() public view override returns (uint8) {
        return underlyingDecimals;
    }
}
