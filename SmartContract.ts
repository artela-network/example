// simple_contract.ts

import { context, storage, logging, PersistentMap } from "near-sdk-as";

// Define a map to store key-value pairs
const keyValueStore = new PersistentMap<string, string>("kvstore:");

// Set a value for a given key
export function set(key: string, value: string): void {
    const sender = context.sender;
    logging.log(sender + " set " + key + " to " + value);
    keyValueStore.set(key, value);
}

// Get the value for a given key
export function get(key: string): string | null {
    return keyValueStore.get(key);
}
