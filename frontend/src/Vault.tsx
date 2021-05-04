import { BigNumber } from "@ethersproject/bignumber";
import { formatUnits, parseUnits } from "@ethersproject/units";
import React, { useEffect, useState } from "react";
import { useFire, useHarvester, useVault } from "./hooks/useContract";
import "./Vault.css";

function Vault(props: any) {
  const fire = useFire();
  const harvester = useHarvester();
  const vault = useVault(props.address);

  const [name, setName] = useState("");
  const [decimals, setDecimals] = useState(0);
  const [underlyingYield, setUnderlyingYield] = useState(0);

  const handleEarn = () => {
    if (vault) {
      vault.earn();
    }
  };

  const handleHarvest = async () => {
    if (fire && harvester && vault) {
      const y = parseUnits(underlyingYield.toString(), decimals);
      const underlying = await vault.underlying();
      const target = await vault.target();
      harvester.harvestVault(
        vault.address,
        y,
        0,
        [underlying, target],
        [target, fire.address],
        Math.round(Date.now() / 1000) + 1800,
      );
    }
  };

  useEffect(() => {
    if (vault) {
      vault.name().then(setName);
      vault.decimals().then(setDecimals);
      vault.callStatic.underlyingYield().then((y) => {
        setUnderlyingYield(parseFloat(formatUnits(y, decimals)));
      });
    }
  }, [vault]);

  return (
    <div className="vault">
      <h3>{name}</h3>
      <p>Underlying yield: {underlyingYield}</p>
      <button onClick={handleEarn}>Earn</button>
      <button onClick={handleHarvest}>Harvest</button>
    </div>
  );
}

export default Vault;
