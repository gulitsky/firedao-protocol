// SPDX-License-Identifier: AGPL-3.0

pragma solidity 0.8.4;

interface IStrategy {
    function invest() external;

    function divest(uint256 amount) external;

    function calcTotalValue() external returns (uint256);
}
