import hre, { ethers, deployments } from "hardhat";
import { signTypedData } from "./utils/general";
import { saltNonce } from "./utils/constants";
import deploymentData from "../test/json/NXVDeployment.json";
import NXVRuntimeBytecode from "../test/json/NXVRuntimeBytecode.json";
import { getNXVWithSingleton, migrationContractFrom100To110, getNXVSingletonAt } from "../test/utils/setup";

// first deploy migrate contract, libraries/NXVMigration.sol, then wallet delegate call migrate() method of migrate contract, so every time
// upgrade need to deploy migrate contract again, the purpose is that we don't need to add permission check in contract like transparent proxy
// and UUPS proxy, which will increase the complexity of contract and waste gas
async function main() {

    const NXV_SINGLETON_141_ADDRESS = "0x0787Bedd6bb2Db4c9013B736BC251e9Edd091bdC";

    const COMPATIBILITY_FALLBACK_HANDLER_141 = "0x542a2e3c52E8C78300906ec29786a9E8dE33C4B9";

    const FALLBACK_HANDLER_STORAGE_SLOT = "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5";

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();

        // Set the runtime code for hardcoded addresses
        await hre.network.provider.send("hardhat_setCode", [NXV_SINGLETON_141_ADDRESS, NXVRuntimeBytecode.NXV110]);
        await hre.network.provider.send("hardhat_setCode", [
            COMPATIBILITY_FALLBACK_HANDLER_141,
            NXVRuntimeBytecode.NXV110fallbackHandler,
        ]);

        const signers = await ethers.getSigners();
        const [user1, user2] = signers;
        const singleton130Address = (await (await user1.sendTransaction({ data: deploymentData.NXV100 })).wait())?.contractAddress;
        if (!singleton130Address) {
            throw new Error("Could not deploy NXV100");
        }
        const singleton130 = await getNXVSingletonAt(singleton130Address);

        const migration: any = await (await migrationContractFrom100To110()).deploy();
        return {
            NXV100: await getNXVWithSingleton(singleton130, [user1.address, user2.address]),
            migration,
            signers,
        };
    });

    const { NXV100, migration, signers } = await setupTests() as {NXV100: any, migration: any, signers: any[]};

    const walletAddress = await NXV100.getAddress();
    const migrationNXV = migration.attach(walletAddress);

    const migratedInterface = new ethers.Interface(["function masterCopy() view returns(address)"]);

    // migratedInterface.encodeFunctionData("masterCopy")
    console.log("masterCopyData:", migratedInterface.encodeFunctionData("masterCopy"));
    // const masterCopyData = "0xa619486e00000000000000000000000000000000000000000000000000000000"; // this is masterCopy() data
    const masterCopyData = "0xa619486e";

    const response = await signers[0].call({ to: walletAddress, data: masterCopyData });
    const abiCoder = new ethers.AbiCoder();
    const masterCopyAddress = abiCoder.decode(["address"], response)[0];
    console.log("Master Copy Address Before:", masterCopyAddress);
    const fallbackHandlerAddressBefore = await NXV100.getStorageAt(FALLBACK_HANDLER_STORAGE_SLOT, 1);
    console.log("fallbackHandlerAddressBefore:", fallbackHandlerAddressBefore);
    // process.exit(0);

    const amount = 0;
    const data = migration.interface.encodeFunctionData("migrateWithFallbackHandler", []);
    // process.exit(0);

    const txData = {
        to: await migration.getAddress(),
        value: amount,
        data: data,
        operation: 1,  // delegatecall
        nonce: saltNonce,
    };

    const sortedSignatures = await signTypedData(txData, walletAddress);

    const transaction = await NXV100.execTransaction(
        ...Object.values(txData),
        sortedSignatures,
        // { gasPrice: ethers.utils.parseUnits('2', 'gwei') }
    );
    
    const receipt = await transaction.wait();
    console.log('Transaction Hash:', receipt?.hash);

    const gasUsed = receipt?.gasUsed;

    console.log('Transaction gasUsed:', gasUsed?.toString());
    const response1 = await signers[0].call({ to: walletAddress, data: masterCopyData });
    const abiCoder1 = new ethers.AbiCoder();
    const masterCopyAddressAfter = abiCoder1.decode(["address"], response1)[0];
    console.log("Master Copy Address After:", masterCopyAddressAfter);

    const fallbackHandlerAddressAfter = await NXV100.getStorageAt(FALLBACK_HANDLER_STORAGE_SLOT, 1);
    console.log("fallbackHandlerAddressAfter:", fallbackHandlerAddressAfter);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

