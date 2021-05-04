import React, { useEffect, useState } from "react";
import { useWeb3React } from "@web3-react/core";
import { ethers, Contract, utils } from "ethers";

import {
  address as fireAddress,
  abi as fireAbi,
} from "./../deployments/bsc/FIRE.json";
import {
  address as harvesterAddress,
  abi as harvesterAbi,
} from "./../deployments/bsc/Harvester.json";
import {
  address as vaultAddress,
  abi as vaultAbi,
} from "./../deployments/bsc/Vault.json";

export function useContract(address: string, abi: ethers.ContractInterface) {
  const { account, library, active } = useWeb3React();
  if (!library || !active) {
    return null;
  }
  return new ethers.Contract(address, abi, library.getSigner(account));
}

export function useFire() {
  return useContract(fireAddress, fireAbi);
}

export function useVault(address: string) {
  return useContract(address, vaultAbi);
}

export function useHarvester() {
  return useContract(harvesterAddress, harvesterAbi);
}
