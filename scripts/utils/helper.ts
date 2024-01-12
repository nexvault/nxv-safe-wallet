import { ethers } from "ethers";

export const keccak256 = (message: string): string => {
  // calculate Keccak256 hash using ethers.js library
  const hash = ethers.keccak256(ethers.toUtf8Bytes(message));
  return hash;
}

// example
const message = "NXVMessage(bytes message)";
const hash = keccak256(message);
console.log(`Keccak256 Hash of "${message}":`, hash);
