// SPDX-License-Identifier: AGPL-3.0

pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import {IVault} from "./../Vault.sol";
import "./IStrategy.sol";

contract BeltFiStrategy is Ownable, IStrategy {
    using Math for uint256;
    using SafeERC20 for IERC20Metadata;

    IVault public vault;
    IERC20Metadata public underlying;
    address public strategist;
    uint256 public immutable minWithdrawalCap;
    uint256 public withdrawalCap = type(uint256).max;

    modifier onlyStrategist {
        require(
            _msgSender() == strategist || _msgSender() == owner(),
            "BeltFiStrategy: only strategist or timelock allowed"
        );
        _;
    }

    modifier onlyVault {
        require(_msgSender() == address(vault), "VenusStrategy: only vault allowed");
        _;
    }
}
