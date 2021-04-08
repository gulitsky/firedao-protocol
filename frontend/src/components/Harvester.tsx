import React, { useContext, useEffect, useState } from 'react';
import { HarvesterContext } from "../hardhat/SymfoniContext";

interface Props { }

export const Harvester: React.FC<Props> = () => {
    const harvester = useContext(HarvesterContext)
    useEffect(() => {
        const doAsync = async () => {
            if (!harvester.instance) return
            console.log("Harvester is deployed at ", harvester.instance.address)
        };
        doAsync();
    }, [harvester])

    const handleHarvestVault = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault()
        if (!harvester.instance) throw Error("Greeter instance not ready")
        if (harvester.instance) {
          /*
            const tx = await harvester.instance.setGreeting(inputGreeting)
            console.log("setGreeting tx", tx)
            await tx.wait()
            console.log("New greeting mined, result: ", await harvester.instance.greet())
            */
        }
    }
    return (
        <div>
            <button onClick={(e) => handleHarvestVault(e)}>Harvest vault</button>
        </div>
    )
}
