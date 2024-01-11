import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumberish } from "ethers";
import { buildNXVTransaction } from "../src/utils/execution";
import { benchmark, Contracts } from "./utils/setup";

benchmark("ERC20", async () => {
    const [, , , , user5] = await ethers.getSigners();

    return [
        {
            name: "transfer",
            prepare: async (contracts: Contracts, target: string, nonce: BigNumberish) => {
                const token = contracts.additions.token;
                const tokenAddress = await token.getAddress();
                await token.transfer(target, 1000);
                const data = token.interface.encodeFunctionData("transfer", [user5.address, 500]);
                return buildNXVTransaction({ to: tokenAddress, data, nonce });
            },
            after: async (contracts: Contracts) => {
                expect(await contracts.additions.token.balanceOf(user5.address)).to.eq(500n);
            },
            fixture: async () => {
                const tokenFactory = await ethers.getContractFactory("ERC20Token");
                return {
                    token: await tokenFactory.deploy(),
                };
            },
        },
    ];
});
