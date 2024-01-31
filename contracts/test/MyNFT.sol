// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title ERC721Token - A test ERC721 token contract.
 */
contract MyNFT is ERC721 {
    uint public MAX_NFT_SUPPLY = 10000;
    uint256 public _tokenId;

    constructor() ERC721("Game", "GMT") {
    }

    function _baseURI() internal pure override returns (string memory) {
        return "ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/";
    }

    function mint() external {
        require(_tokenId >= 0 && _tokenId <= MAX_NFT_SUPPLY, "Token ID invalid");
        _mint(msg.sender, _tokenId);
        _tokenId++;
    }
}
// NFT contract address on Goerli testnet
// https://goerli.etherscan.io/address/0xe81335d1a0d64f00b5d44df1fd132170e2f4ba29
