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
      <Vault address="0x97608f85D94F0DC6F66180aD895C88eC71EdB8C8"></Vault>
      <Vault address="0x5F22e218281B71143dfd3923D1adC0073d49dB2F"></Vault>
    </div>
  );
}

export default App;
