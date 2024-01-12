import { ethers } from "hardhat";
import { signTypedData } from "./utils/general";
import { deployments, userConfig } from "hardhat";
import { getNXVWithOwners } from "../test/utils/setup";


async function main() {
    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();    // this will run all deploy scripts
        const signers = await ethers.getSigners();
        const [user1, user2] = signers;
        return {
            nxv: await getNXVWithOwners([user1.address, user2.address]),
        }
    });
    const {nxv} = await setupTests() as {nxv: any};
    const walletAddress = await nxv.getAddress();

    const [deployer, user] = await ethers.getSigners();

    const saltNonce: number = new Date().getTime();
    console.log(saltNonce);

    console.log('Sending 0.0001 Ether to this MultiSigWallet contract will be deployed...', "\n");
    await deployer.sendTransaction({
        to: walletAddress,
        value: ethers.parseEther('0.001')
    });

    const amount = ethers.parseEther('0.00001');

    const txData = {
        to: deployer.address,
        value: amount,
        data: "0x",
        operation: 0,
        nonce: saltNonce,
    };

    const sortedSignatures = await signTypedData(txData, walletAddress);

    const transaction = await nxv.execTransaction(
        ...Object.values(txData),
        sortedSignatures,
        // { gasPrice: ethers.utils.parseUnits('2', 'gwei') }
    );
    
    const receipt = await transaction.wait();
    console.log('Transaction Hash:', receipt?.hash);

    const gasUsed = receipt?.gasUsed;

    console.log('Transaction gasUsed:', gasUsed?.toString());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
