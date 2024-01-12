import { signTypedData } from "./utils/general";
import hre, { ethers, deployments } from "hardhat";
import { saltNonce } from "./utils/constants";
import { getNXVWithOwners, compatFallbackHandlerDeployment } from "../test/utils/setup";

// first deploy NFT contract, then mint two tokens, then transfer the second token to NXV contract, then call the batchSignature method of NXV contract,
// call the safeTransferFrom method of NFT contract to transfer the token back
// safeTransferFrom method, safeTransferFrom will check whether the receiver has implemented the onERC721Received method
async function main() {
    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture(); // this will run all deploy scripts
        const signers = await ethers.getSigners();
        const [user1, user2] = signers;
        return {
            nxv: await getNXVWithOwners([user1.address, user2.address], 2, (await compatFallbackHandlerDeployment()).address),
        }
    });

    const {nxv} = await setupTests() as {nxv: any};

    const walletAddress = await nxv.getAddress();

    const [deployer] = await ethers.getSigners();
   
    const nftContract: any = await (await hre.ethers.getContractFactory("MyNFT")).deploy();
    
    const callData = nftContract.interface.encodeFunctionData(
        "mint",
        []
    );
    console.log(callData);

    const tx1 = await nftContract.connect(deployer).mint();
    const receipt1 = await tx1.wait();
    console.log('Transaction Hash:', receipt1.hash);
    const tx2 = await nftContract.connect(deployer).mint();
    const receipt2 = await tx2.wait();
    console.log('Transaction Hash:', receipt2.hash);

    const deployAmountBefore = await nftContract.balanceOf(deployer.address);
    console.log("deployer nft number Before:", deployAmountBefore);

    const walletAmountBefore = await nftContract.balanceOf(walletAddress);
    console.log("NXVWallet nft number Before:", walletAmountBefore);

    const from = await deployer.getAddress();
    const tx3 = await nftContract["safeTransferFrom(address,address,uint256)"](from, walletAddress, 1);
    const receipt3 = await tx3.wait();
    console.log('Transaction Hash:', receipt3.hash);
    const walletAmount = await nftContract.balanceOf(walletAddress);
    console.log("NXVWallet nft number Received:", walletAmount);
    // process.exit(0);

    const data = nftContract.interface.encodeFunctionData(
        "safeTransferFrom(address,address,uint256)",
        [walletAddress, from, 1]
    );

    const txData = {
        to: await nftContract.getAddress(),
        value: 0,
        data: data,
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
    console.log('Transaction Hash:', receipt.hash);

    const gasUsed = receipt.gasUsed;

    console.log('Transaction gasUsed:', gasUsed.toString());

    const deployerAmountAfter = await nftContract.balanceOf(deployer.address);
    console.log("deployer nft number After:", deployerAmountAfter);

    const walletAmountAfter = await nftContract.balanceOf(walletAddress);
    console.log("NXVWallet nft number After:", walletAmountAfter);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
