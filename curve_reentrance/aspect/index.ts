
import {
    allocate,
    entryPoint,
    execute,
    IPreContractCallJP,
    PreContractCallInput,
    CallTreeQuery,
    EthCallTree,
    ethereum,
    sys,
    InitInput
} from "@artela-next/aspect-libs";

import {Protobuf} from "as-proto/assembly/Protobuf";

/**
 * Please describe what functionality this aspect needs to implement.
 *
 * About the concept of Aspect @see [join-point](https://docs.artela.network/develop/core-concepts/join-point)
 * How to develop an Aspect  @see [Aspect Structure](https://docs.artela.network/develop/reference/aspect-lib/aspect-structure)
 */
class Aspect implements IPreContractCallJP {
    init(input: InitInput): void {
        return
    }

    /**
     * isOwner is the governance account implemented by the Aspect, when any of the governance operation
     * (including upgrade, config, destroy) is made, isOwner method will be invoked to check
     * against the initiator's account to make sure it has the permission.
     *
     * @param sender address of the transaction
     * @return true if check success, false if check fail
     */
    isOwner(sender: Uint8Array): bool {
        return false;
    }

    /**
     * postContractCall is a join-point which will be invoked after a contract call has finished.
     *
     * @param input input to the current join point
     */
    preContractCall(input: PreContractCallInput): void {
        // Get the method of currently called contract.
        const currentCallMethod = ethereum.parseMethodSig(input.call!.data);

        // Define functions that are not allowed to be reentered.
        const noReentrantMethods : Array<string> = [
            ethereum.computeMethodSig('add_liquidity()'),
            ethereum.computeMethodSig('remove_liquidity()')
        ];

        // Verify if the current method is within the scope of functions that are not susceptible to reentrancy.
        if (noReentrantMethods.includes(currentCallMethod)) {
            // Check if there already exists a non-reentrant method on the current call path.
            const callTreeQuery = new CallTreeQuery(-1);
            const callTreeRaw = sys.hostApi.trace.queryCallTree(callTreeQuery);
            const callTree = Protobuf.decode<EthCallTree>(callTreeRaw, EthCallTree.decode);
            let parentCallIndex = callTree.calls[input.call!.index as i32].parentIndex;
            while (parentCallIndex >= 0) {
                const parentCall = callTree.calls[parentCallIndex as i32];
                if (noReentrantMethods.includes(ethereum.parseMethodSig(parentCall.data))) {
                    // If yes, revert the transaction.
                    sys.revert(`illegal transaction: method reentered from ${currentCallMethod} to ${ethereum.parseMethodSig(parentCall.data)}`);
                }
                parentCallIndex = parentCall.parentIndex;
            }
        }
    }
}

// 2.register aspect Instance
const aspect = new Aspect()
entryPoint.setAspect(aspect)

// 3.must export it
export { execute, allocate }

