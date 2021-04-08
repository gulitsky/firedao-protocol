import React from 'react';
import logo from './logo.svg';
import './App.css';
import { Symfoni } from "./hardhat/SymfoniContext";
import { Vault } from './components/Vault';

function App() {

  return (
    <div className="App">
      <header className="App-header">
        <Symfoni autoInit={true} >
          <Vault></Vault>
        </Symfoni>
      </header>
    </div>
  );
}

export default App;
