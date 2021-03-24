// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IStrategy} from "./strategies/IStrategy.sol";
import {IVault} from "./Vault.sol";

interface IController {}

contract Controller is IController {
    using SafeERC20 for IERC20;

    address public governance;
    address public strategist;
    address public treasury;

    mapping(IERC20 => IVault) public vaults;
    mapping(IERC20 => IStrategy) public strategies;

    constructor(address _treasury) {
        treasury = _treasury;
    }

    function setTreasury(address _treasury) public {
        require(msg.sender == governance, "Controller: only gov allowed");
        treasury = _treasury;
    }
}
