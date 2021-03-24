// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.3;

import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./interfaces/ERC2222/IFundsDistributionToken.sol";

contract ERC20FundsDistributionToken is ERC20, IFundsDistributionToken {
    using SafeCast for int256;
    using SafeCast for uint256;

    uint256 internal constant POINTS_MULTIPLIER = 2**165;

    uint256 internal pointsPerShare;
    mapping(address => int256) internal pointsCorrection;

    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {}

    function withdrawFunds() external override {}

    function withdrawableFundsOf(address owner) external view override returns (uint256) {}

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal override {
        super._transfer(sender, recipient, amount);

        int256 magCorrection = (pointsPerShare * amount).toInt256();
        pointsCorrection[sender] = pointsCorrection[sender] + magCorrection;
        pointsCorrection[recipient] = pointsCorrection[recipient] - magCorrection;
    }

    function accumulativeFundsOf(address account) public view returns (uint256) {
        return
            ((pointsPerShare * balanceOf(account)).toInt256() + pointsCorrection[account]).toUint256() /
            POINTS_MULTIPLIER;
    }

    function _mint(address account, uint256 amount) internal override {
        super._mint(account, amount);

        pointsCorrection[account] = pointsCorrection[account] - (pointsPerShare * amount).toInt256();
    }

    function _burn(address account, uint256 amount) internal override {
        super._burn(account, amount);

        pointsCorrection[account] = pointsCorrection[account] + (pointsPerShare * amount).toInt256();
    }
}
