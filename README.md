NXV - Safe Wallet
==============

NXV Safe Wallet is developed based on the Safe v1.4.1 version, and the following are the main changes made in comparison to Safe:

1. Removed the restriction on sequential execution of transaction nonce, added the `txNonces` state variables, supporting the pre-signed transactions;
2. Removed the logic and related parameters for transaction execution gas payment;
3. Deleted the `Module` and `Guard` functionality modules originally in Safe;
4. Added the `createMultiSigWalletWithTransaction()` function to the factory contract, to support platform business scenarios;
5. Added the `calculateMultiSigWalletAddress()` function to the factory contract, to facilitate the calculation of proxy addresses.

Usage
-----
### Install requirements with npm:

```bash
npm i
```

### Testing

To run the tests:

```bash
npm run build
npm run test
```


### Deploy

This will deploy the contracts deterministically and verify the contracts on etherscan using [Solidity 0.8.17](https://github.com/ethereum/solidity/releases/tag/v0.8.17) by default.

Preparation:
- Set `MNEMONIC` in `.env`
- Set `INFURA_KEY` in `.env`

When you use other evm network, you can modify `hardhat.config.ts` networks configurations.

```bash
npm run deploy-all <network>
```

This will perform the following steps:

```bash
npm run build
npx hardhat --network <network> deploy
npx hardhat --network <network> etherscan-verify --force-license --license "LGPL-3.0"
npx hardhat --network <network> sourcify
npx hardhat --network <network> local-verify
```

Details can found in [src/tasks/deploy_contracts.ts](./src/tasks/deploy_contracts.ts).

Security
-----

[Audit for v1.0.0 by Certik](./docs/REP-final-20240201T010322Z.pdf)

License
-----
All smart contracts are released under LGPL-3.0
