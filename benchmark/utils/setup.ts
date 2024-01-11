import { expect } from "chai";
import hre, { deployments, ethers } from "hardhat";
import { BigNumberish } from "ethers";
import { getTokenCallbackHandler, getNXVWithOwners } from "../../test/utils/setup";
import {
    logGas,
    executeTx,
    NXVTransaction,
    NXVSignTypedData,
    NXVSignature,
    executeContractCallWithSigners,
} from "../../src/utils/execution";
import { AddressZero } from "@ethersproject/constants";
import { NXV } from "../../typechain-types";

type NXVSingleton = NXV;

export interface Contracts {
    targets: NXVSingleton[];
    additions: any | undefined;
}

const generateTarget = async (owners: number, threshold: number, guardAddress: string, logGasUsage?: boolean) => {
    const fallbackHandler = await getTokenCallbackHandler();
    const fallbackHandlerAddress = await fallbackHandler.getAddress();
    const signers = (await ethers.getSigners()).slice(0, owners);
    const NXV = await getNXVWithOwners(
        signers.map((owner) => owner.address),
        threshold,
        fallbackHandlerAddress,
        logGasUsage,
    );
    await executeContractCallWithSigners(NXV, NXV, "setGuard", [guardAddress], signers);
    return NXV;
};

export const configs = [
    { name: "single owner", signers: 1, threshold: 1 },
    { name: "single owner and guard", signers: 1, threshold: 1, useGuard: true },
    { name: "2 out of 2", signers: 2, threshold: 2 },
    { name: "3 out of 3", signers: 3, threshold: 3 },
    { name: "3 out of 5", signers: 5, threshold: 3 },
];

export const setupBenchmarkContracts = (benchmarkFixture?: () => Promise<any>, logGasUsage?: boolean) => {
    return deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const guardFactory = await hre.ethers.getContractFactory("DelegateCallTransactionGuard");
        const guard = await guardFactory.deploy(AddressZero);
        const guardAddress = await guard.getAddress();
        const targets: NXVSingleton[] = [];
        for (const config of configs) {
            targets.push(await generateTarget(config.signers, config.threshold, config.useGuard ? guardAddress : AddressZero, logGasUsage));
        }
        return {
            targets,
            additions: benchmarkFixture ? await benchmarkFixture() : undefined,
        };
    });
};

export interface Benchmark {
    name: string;
    prepare: (contracts: Contracts, target: string, nonce: BigNumberish) => Promise<NXVTransaction>;
    after?: (contracts: Contracts) => Promise<void>;
    fixture?: () => Promise<any>;
}

type BenchmarkWithSetup = () => Promise<Benchmark[]>;

export const benchmark = async (topic: string, benchmarks: BenchmarkWithSetup) => {
    const setupBenchmarks = await benchmarks();

    for (const benchmark of setupBenchmarks) {
        const { name, prepare, after, fixture } = benchmark;
        const contractSetup = setupBenchmarkContracts(fixture);
        describe(`${topic} - ${name}`, () => {
            it("with an EOA", async () => {
                const contracts = await contractSetup();
                const [, , , , , user6] = await ethers.getSigners();
                const tx = await prepare(contracts, user6.address, 0);
                await logGas(
                    name,
                    user6.sendTransaction({
                        to: tx.to,
                        value: tx.value,
                        data: tx.data,
                    }),
                );
                if (after) await after(contracts);
            });
            for (const i in configs) {
                const config = configs[i];
                it(`with a ${config.name} NXV`, async () => {
                    const contracts = await contractSetup();
                    const target = contracts.targets[i];
                    const targetAddress = await target.getAddress();
                    const nonce = await target.nonce();
                    const tx = await prepare(contracts, targetAddress, nonce);
                    const threshold = await target.getThreshold();
                    const signers = await ethers.getSigners();
                    const sigs: NXVSignature[] = await Promise.all(
                        signers.slice(0, Number(threshold)).map(async (signer) => {
                            const targetAddress = await target.getAddress();
                            return await NXVSignTypedData(signer, targetAddress, tx);
                        }),
                    );
                    await expect(logGas(name, executeTx(target, tx, sigs))).to.emit(target, "ExecutionSuccess");
                    if (after) await after(contracts);
                });
            }
        });
    }
};
