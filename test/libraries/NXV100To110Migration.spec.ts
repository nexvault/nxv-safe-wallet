import { expect } from "chai";
import hre, { ethers, deployments } from "hardhat";
import { getNXVWithSingleton, migrationContractFrom100To110, getNXVSingletonAt } from "../utils/setup";
import deploymentData from "../json/NXVDeployment.json";
import NXVRuntimeBytecode from "../json/NXVRuntimeBytecode.json";
import { executeContractCallWithSigners } from "../../src/utils/execution";

const NXV_SINGLETON_110_ADDRESS = "0x0787Bedd6bb2Db4c9013B736BC251e9Edd091bdC";

const COMPATIBILITY_FALLBACK_HANDLER_110 = "0x542a2e3c52E8C78300906ec29786a9E8dE33C4B9";

const FALLBACK_HANDLER_STORAGE_SLOT = "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5";

describe("NXV100To110Migration library", () => {
    const migratedInterface = new ethers.Interface(["function masterCopy() view returns(address)"]);

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();

        // Set the runtime code for hardcoded addresses
        await hre.network.provider.send("hardhat_setCode", [NXV_SINGLETON_110_ADDRESS, NXVRuntimeBytecode.NXV110]);
        await hre.network.provider.send("hardhat_setCode", [
            COMPATIBILITY_FALLBACK_HANDLER_110,
            NXVRuntimeBytecode.NXV110fallbackHandler,
        ]);

        const signers = await ethers.getSigners();
        const [user1] = signers;
        const singleton100Address = (await (await user1.sendTransaction({ data: deploymentData.NXV100 })).wait())?.contractAddress;
        if (!singleton100Address) {
            throw new Error("Could not deploy NXV100");
        }
        const singleton130 = await getNXVSingletonAt(singleton100Address);

        const migration: any = await (await migrationContractFrom100To110()).deploy();
        return {
            NXV100: await getNXVWithSingleton(singleton130, [user1.address]),
            migration,
            signers,
        };
    });

    describe("constructor", () => {
        it("cannot be initialized if the contracts are not deployed", async () => {
            const factory = await migrationContractFrom100To110();
            await expect(factory.deploy()).to.be.revertedWith("NXV 1.1.0 Singleton is not deployed");
        });
    });

    describe("migrate", () => {
        it("can only be called from NXV itself", async () => {
            const { migration } = await setupTests();
            await expect(migration.migrate()).to.be.revertedWith("Migration should only be called via delegatecall");
        });

        it("can migrate", async () => {
            const {
                NXV100,
                migration,
                signers: [user1],
            } = await setupTests();
            const NXVAddress = await NXV100.getAddress();
            // The emit matcher checks the address, which is the NXV as delegatecall is used
            const migrationNXV = migration.attach(NXVAddress);

            await expect(executeContractCallWithSigners(NXV100, migration, "migrate", [], [user1], true))
                .to.emit(migrationNXV, "ChangedMasterCopy")
                .withArgs(NXV_SINGLETON_110_ADDRESS);

            const singletonResp = await user1.call({ to: NXVAddress, data: migratedInterface.encodeFunctionData("masterCopy") });
            await expect(migratedInterface.decodeFunctionResult("masterCopy", singletonResp)[0]).to.eq(NXV_SINGLETON_110_ADDRESS);
        });

        it("doesn't touch important storage slots", async () => {
            const {
                NXV100,
                migration,
                signers: [user1],
            } = await setupTests();
            const NXVAddress = await NXV100.getAddress();

            const ownerCountBeforeMigration = await hre.ethers.provider.getStorage(NXVAddress, 2);
            const thresholdBeforeMigration = await hre.ethers.provider.getStorage(NXVAddress, 3);
            const nonceBeforeMigration = await hre.ethers.provider.getStorage(NXVAddress, 5);

            expect(executeContractCallWithSigners(NXV100, migration, "migrate", [], [user1], true));

            expect(await hre.ethers.provider.getStorage(NXVAddress, 2)).to.be.eq(ownerCountBeforeMigration);
            expect(await hre.ethers.provider.getStorage(NXVAddress, 3)).to.be.eq(thresholdBeforeMigration);
            expect(await hre.ethers.provider.getStorage(NXVAddress, 5)).to.be.eq(nonceBeforeMigration);
        });
    });

    describe("migrateWithFallbackHandler", () => {
        it("can only be called from NXV itself", async () => {
            const { migration } = await setupTests();
            await expect(migration.migrateWithFallbackHandler()).to.be.revertedWith("Migration should only be called via delegatecall");
        });

        it("can migrate", async () => {
            const {
                NXV100,
                migration,
                signers: [user1],
            } = await setupTests();
            const NXVAddress = await NXV100.getAddress();
            // The emit matcher checks the address, which is the NXV as delegatecall is used
            const migrationNXV = migration.attach(NXVAddress);

            await expect(executeContractCallWithSigners(NXV100, migration, "migrateWithFallbackHandler", [], [user1], true))
                .to.emit(migrationNXV, "ChangedMasterCopy")
                .withArgs(NXV_SINGLETON_110_ADDRESS)
                .and.to.emit(NXV100, "ChangedFallbackHandler")
                .withArgs(COMPATIBILITY_FALLBACK_HANDLER_110);

            const singletonResp = await user1.call({ to: NXVAddress, data: migratedInterface.encodeFunctionData("masterCopy") });
            await expect(migratedInterface.decodeFunctionResult("masterCopy", singletonResp)[0]).to.eq(NXV_SINGLETON_110_ADDRESS);

            expect(await NXV100.getStorageAt(FALLBACK_HANDLER_STORAGE_SLOT, 1)).to.eq(
                "0x" + COMPATIBILITY_FALLBACK_HANDLER_110.slice(2).toLowerCase().padStart(64, "0"),
            );
        });

        it("doesn't touch important storage slots", async () => {
            const {
                NXV100,
                migration,
                signers: [user1],
            } = await setupTests();
            const NXVAddress = await NXV100.getAddress();

            const ownerCountBeforeMigration = await hre.ethers.provider.getStorage(NXVAddress, 2);
            const thresholdBeforeMigration = await hre.ethers.provider.getStorage(NXVAddress, 3);
            const nonceBeforeMigration = await hre.ethers.provider.getStorage(NXVAddress, 5);

            await expect(executeContractCallWithSigners(NXV100, migration, "migrateWithFallbackHandler", [], [user1], true));

            expect(await hre.ethers.provider.getStorage(NXVAddress, 2)).to.be.eq(ownerCountBeforeMigration);
            expect(await hre.ethers.provider.getStorage(NXVAddress, 3)).to.be.eq(thresholdBeforeMigration);
            expect(await hre.ethers.provider.getStorage(NXVAddress, 5)).to.be.eq(nonceBeforeMigration);
        });
    });
});
