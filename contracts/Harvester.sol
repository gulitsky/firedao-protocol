// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IERC20Metadata.sol";
import "./interfaces/IPancakeRouter.sol";
import {IVault} from "./Vault.sol";

interface IHarvester {
    function harvestVault(
        IVault vault,
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        uint256 deadline
    ) external;
}

contract Harvester is Ownable, IHarvester {
    using SafeERC20 for IERC20Metadata;

    IPancakeRouter public pancakeRouter;
    mapping(IVault => uint256) public ratePerToken;

    constructor(IPancakeRouter _pancakeRouter) {
        pancakeRouter = _pancakeRouter;
    }

    function harvestVault(
        IVault vault,
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        uint256 deadline
    ) external override onlyOwner {
        uint256 amount = vault.harvest(amountIn);
        uint256 durationSinceLastHarvest = block.timestamp - vault.lastDistributionAt();
        IERC20Metadata from = vault.underlying();
        ratePerToken[vault] = (amount * (10**(36 - from.decimals()))) / vault.totalSupply() / durationSinceLastHarvest;

        // TODO: 10 % to FIRE buyback and burn
        IERC20Metadata to = vault.target();
        if (address(from) != address(to)) {
            from.approve(address(pancakeRouter), amount);
            amount = pancakeRouter.swapExactTokensForTokens(amount, amountOutMin, path, address(this), deadline)[
                path.length - 1
            ];
        }
        to.approve(address(vault), amount);
        vault.distributeDividends(amount);
    }

    function sweep(IERC20Metadata token) external onlyOwner {
        token.safeTransfer(owner(), token.balanceOf(address(this)));
    }
}
