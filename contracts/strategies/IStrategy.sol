// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.3;

interface IStrategy {
    function invest() external;

    function divest(uint256 amount) external;

    function calcTotalValue() external returns (uint256);
}
