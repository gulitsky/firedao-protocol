// SPDX-License-Identifier: AGPL-3.0

pragma solidity 0.8.3;

import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IERC20Metadata.sol";

interface IDividendToken is IERC20 {}

abstract contract DividendToken is IDividendToken, ERC20 {
    using SafeCast for int256;
    using SafeCast for uint256;
    using SafeERC20 for IERC20Metadata;

    uint256 internal constant MAGNITUDE = 2**128;

    IERC20Metadata public immutable targetToken;

    uint256 internal magnifiedDividendPerShare;
    mapping(address => int256) internal magnifiedDividendCorrections;

    mapping(address => uint256) internal withdrawnDividends;

    event DividendsDistributed(address indexed account, uint256 amount);
    event DividendWithdrawn(address indexed account, uint256 amount);

    constructor(
        string memory name,
        string memory symbol,
        IERC20Metadata _targetToken
    ) ERC20(name, symbol) {
        targetToken = _targetToken;
    }

    function withdrawableDividendOf(address account) public view returns (uint256) {
        return accumulativeDividendOf(account) - withdrawnDividends[account];
    }

    function withdrawnDividendOf(address account) public view returns (uint256) {
        return withdrawnDividends[account];
    }

    function accumulativeDividendOf(address account) public view returns (uint256) {
        return
            ((magnifiedDividendPerShare * balanceOf(account)).toInt256() + magnifiedDividendCorrections[account])
                .toUint256() / MAGNITUDE;
    }

    function withdrawDividend(address account) internal {
        uint256 withdrawableDividend = withdrawableDividendOf(account);
        require(withdrawableDividend > 0, "DividendToken: nothing to withdraw");

        withdrawnDividends[account] = withdrawnDividends[account] + withdrawableDividend;
        targetToken.safeTransfer(account, withdrawableDividend);

        emit DividendWithdrawn(account, withdrawableDividend);
    }

    function _distributeDividends(uint256 amount) internal {
        require(totalSupply() > 0, "DividendToken: total supply is zero");
        require(amount > 0, "DividendToken: nothing to distribute");

        magnifiedDividendPerShare = magnifiedDividendPerShare + ((amount * MAGNITUDE) / totalSupply());
        targetToken.safeTransferFrom(_msgSender(), address(this), amount);

        emit DividendsDistributed(_msgSender(), amount);
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal override {
        super._transfer(sender, recipient, amount);

        int256 magCorrection = (magnifiedDividendPerShare * amount).toInt256();
        magnifiedDividendCorrections[sender] = magnifiedDividendCorrections[sender] + magCorrection;
        magnifiedDividendCorrections[recipient] = magnifiedDividendCorrections[recipient] - magCorrection;
    }

    function _mint(address account, uint256 amount) internal override {
        super._mint(account, amount);

        magnifiedDividendCorrections[account] =
            magnifiedDividendCorrections[account] -
            (magnifiedDividendPerShare * amount).toInt256();
    }

    function _burn(address account, uint256 amount) internal override {
        super._burn(account, amount);

        magnifiedDividendCorrections[account] =
            magnifiedDividendCorrections[account] +
            (magnifiedDividendPerShare * amount).toInt256();
    }
}
