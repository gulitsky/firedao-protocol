import React, { useContext, useEffect, useState } from 'react';
import { VaultContext } from "../hardhat/SymfoniContext";

interface Props { }

export const Vault: React.FC<Props> = () => {
    const vault = useContext(VaultContext)
    const [name, setName] = useState("")
    const [underlyingYield, setUnderlyingYield] = useState({})
    useEffect(() => {
        const doAsync = async () => {
            if (!vault.instance) return;
            console.log("Vault is deployed at ", vault.instance.address)
            setName(await vault.instance.name())
            // setUnderlyingYield(await vault.instance.callStatic.underlyingYield());
        };
        doAsync();
    }, [vault])

    const handleEarnVault = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault()
        if (!vault.instance) throw Error("Vault instance not ready")
        if (vault.instance) {
          const tx = await vault.instance.earn();
          console.debug("earn tx", tx)
          await tx.wait()
        }
    }

    const handleHarvestVault = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault()
        if (!vault.instance) throw Error("Vault instance not ready")
        if (vault.instance) {
          /*
            const tx = await harvester.instance.setGreeting(inputGreeting)
            console.log("setGreeting tx", tx)
            await tx.wait()
            console.log("New greeting mined, result: ", await harvester.instance.greet())
            */
        }
    }

    return (
        <fieldset>
            <legend>{name}</legend>
            <button onClick={(e) => handleEarnVault(e)}>Earn</button>
            <button onClick={(e) => handleHarvestVault(e)}>Harvest</button>
        </fieldset>
    )
}
