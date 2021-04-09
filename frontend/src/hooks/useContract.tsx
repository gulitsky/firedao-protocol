import React, { useEffect, useState } from "react";
import { useWeb3React } from "@web3-react/core";
import { ethers, Contract, utils } from "ethers";

import { abi as harvesterAbi } from "../../../deployments/localhost/Harvester.json";
import { abi as vaultAbi } from "../../../deployments/localhost/Vault.json";

export function useContract(address: string, abi: ethers.ContractInterface) {
  const { library, active } = useWeb3React();
  if (!library || !active) {
    return null;
  }
  return new ethers.Contract(address, abi, library);
}

export function useVault(address: string) {
  return useContract(address, vaultAbi);
}

export function useHarvester(address: string) {
  return useContract(address, vaultAbi);
}
