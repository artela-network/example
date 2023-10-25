// blockchain-explorer.ts

// https://github.com/SerCry/Artela_Block_Explorer_ExampleV1/tree/main


import { storage, env } from "near-sdk-as";

// Define a simple struct for storing block information
@nearBindgen
class Block {
    constructor(public hash: string, public timestamp: u64) {}
}

// Store blocks in a map
const blocks = new Map<u64, Block>();

// Add a new block
export function addBlock(hash: string, timestamp: u64): void {
    const height = storage.getPrimitive<u64>("blockHeight", u64.Zero);
    blocks.set(height, new Block(hash, timestamp));
    storage.set("blockHeight", height + u64.One);
}

// Get block information by block height
export function getBlockByHeight(height: u64): Block | null {
    if (height >= storage.getPrimitive<u64>("blockHeight", u64.Zero)) {
        return null;
    }
    return blocks.get(height);
}

// Get the latest block
export function getLatestBlock(): Block | null {
    const height = storage.getPrimitive<u64>("blockHeight", u64.Zero);
    if (height === u64.Zero) {
        return null;
    }
    return blocks.get(height - u64.One);
}

// Export a function to get the total number of blocks
export function getTotalBlockCount(): u64 {
    return storage.getPrimitive("blockHeight", u64.Zero);
}
