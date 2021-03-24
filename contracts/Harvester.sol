// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/IPancakeRouter.sol";
import {IVault} from "./Vault.sol";

interface IHarvester {
    function harvest(IVault vault) external;
}

contract Harvester is Ownable, IHarvester {
    IPancakeRouter public pancakeRouter;

    constructor(IPancakeRouter _pancakeRouter) {
        pancakeRouter = _pancakeRouter;
    }

    function harvest(IVault vault) public override {}
}
