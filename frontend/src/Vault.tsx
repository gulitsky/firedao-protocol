import React from "react";
import { useHarvester } from "./hooks/useContract";
import "./Vault.css";

function Vault() {
  const Harvester = useHarvester("");

  return <div className="Vault"></div>;
}

export default Vault;
