import React, { useEffect, useState } from "react";
import { useWeb3React } from "@web3-react/core";
import { MetaMask } from "./connectors";
import "./App.css";
import Vault from "./Vault";

function App() {
  const { active, activate, library } = useWeb3React();

  useEffect(() => {
    if (!active) {
      activate(MetaMask);
    }
  }, [active, library, activate]);

  return (
    <div className="App">
      <Vault></Vault>
    </div>
  );
}

export default App;
