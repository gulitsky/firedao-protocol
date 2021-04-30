// SPDX-License-Identifier: AGPL-3.0

pragma solidity 0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "./interfaces/IPancakeRouter.sol";
import {IVault} from "./Vault.sol";

interface IHarvester {
    function harvestVault(
        IVault vault,
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address[] calldata targetToFirePath,
        uint256 deadline
    ) external;
}

contract Harvester is AccessControl, Ownable, IHarvester {
    using SafeERC20 for IERC20Metadata;

    bytes32 public constant HARVESTER_ROLE = keccak256("HARVESTER_ROLE");
    uint256 internal constant BP = 10000; // 100 %

    IPancakeRouter public pancakeRouter;
    address public treasury;
    uint256 public performanceFee = 1000; // 10 %
    uint256 public fireBuyBack = 1000; // 10 %
    mapping(IVault => uint256) public ratePerToken;

    constructor(IPancakeRouter _pancakeRouter, address _treasury) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(HARVESTER_ROLE, _msgSender());

        pancakeRouter = _pancakeRouter;
        treasury = _treasury;
    }

    function harvestVault(
        IVault vault,
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address[] calldata targetToFirePath,
        uint256 deadline
    ) external override {
        require(hasRole(HARVESTER_ROLE, _msgSender()), "Harvester: not whitelisted");

        uint256 amount = amountIn;
        IERC20Metadata from = vault.underlying();
        uint256 afterFee = amount - ((amount * (performanceFee + fireBuyBack)) / BP);
        uint256 durationSinceLastHarvest = block.timestamp - vault.lastDistributionAt();
        ratePerToken[vault] =
            (afterFee * (10**(36 - from.decimals()))) /
            vault.totalSupply() /
            durationSinceLastHarvest;

        vault.harvest(amount);

        IERC20Metadata to = vault.target();
        if (address(from) != address(to)) {
            from.approve(address(pancakeRouter), amount);
            amount = pancakeRouter.swapExactTokensForTokens(amount, amountOutMin, path, address(this), deadline)[
                path.length - 1
            ];
        }

        afterFee = amount;
        if (fireBuyBack > 0) {
            uint256 targetAmount = (amount * fireBuyBack) / BP;
            to.approve(address(pancakeRouter), targetAmount);
            pancakeRouter.swapExactTokensForTokens(
                targetAmount,
                0,
                targetToFirePath,
                address(this),
                block.timestamp + 1800
            );
            afterFee = afterFee - targetAmount;
        }
        if (performanceFee > 0) {
            uint256 fee = (amount * performanceFee) / BP;
            afterFee = afterFee - fee;
            to.safeTransfer(treasury, fee);
        }

        to.approve(address(vault), afterFee);
        vault.distributeDividends(afterFee);
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    function setPerformanceFee(uint256 _performanceFee) external onlyOwner {
        require(_performanceFee < BP, "Harvester: performance fee too high");
        performanceFee = _performanceFee;
    }

    function setFireBuyBack(uint256 _fireBuyBack) external onlyOwner {
        require(_fireBuyBack < BP, "Harvester: fire buy back percent too high");
        fireBuyBack = _fireBuyBack;
    }

    function sweep(IERC20Metadata token) external onlyOwner {
        token.safeTransfer(owner(), token.balanceOf(address(this)));
    }
}
