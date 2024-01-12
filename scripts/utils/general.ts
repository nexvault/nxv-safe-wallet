import { ethers } from "hardhat";

export async function signMessage(messageHash: any, walletAddress: string) {
    const [deployer, user] = await ethers.getSigners();
    const { chainId } = await ethers.provider.getNetwork();

    const domain = {
      name: "NXVWallet",
      chainId: chainId,
      verifyingContract: walletAddress,
    };

    const types = {
      NXVMessage: [
        { name: "message", type: "bytes" }
      ],
    };

    const txData = {
      message: messageHash
    };

    let signatures: any = [];

    const sig0 = await deployer.signTypedData(domain, types, txData);
    signatures.push({
        address: deployer.address,
        signature: sig0
    })

    const sig1 = await user.signTypedData(domain, types, txData);
    signatures.push({
        address: user.address,
        signature: sig1
    })

    // console.log(`Signer ${deployer.address} signature is: ${sig0}`);
    // console.log(`Signer ${user.address} signature is: ${sig1}`);

    // console.log(`${ethers.utils.verifyTypedData(domain, types, txData, sig0)}`);
    // console.log(`${ethers.utils.verifyTypedData(domain, types, txData, sig1)}`);

    signatures = signatures.sort((a: any, b: any) => a.address - b.address);
    
    const sortedSignatures: string = '0x' + signatures.map((sig: { signature: string | any[]; }) => sig.signature.slice(2)).join('');
    console.log("sortedSignatures", sortedSignatures, "\n");
    return sortedSignatures;
}

export async function signTypedData(txData: any, walletAddress: string) {
    const [deployer, user] = await ethers.getSigners();
    const { chainId } = await ethers.provider.getNetwork();

    const domain = {
        name: 'NXVWallet',
        chainId: chainId,
        verifyingContract: walletAddress
    };

    const types = {
        Transaction:[
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "data", type: "bytes" },
            { name: "operation", type: "uint8" },
            { name: "nonce", type: "uint256" },
        ]
    };

    let signatures: any = [];

    const sig0 = await deployer.signTypedData(domain, types, txData);
    signatures.push({
        address: deployer.address,
        signature: sig0
    })

    const sig1 = await user.signTypedData(domain, types, txData);
    signatures.push({
        address: user.address,
        signature: sig1
    })

    signatures = signatures.sort((a: any, b: any) => a.address - b.address);
    
    const sortedSignatures: string = '0x' + signatures.map((sig: { signature: string | any[]; }) => sig.signature.slice(2)).join('');
    return sortedSignatures;
  }

