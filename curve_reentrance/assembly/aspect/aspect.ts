
import {
    FilterTxCtx,
    IAspectBlock,
    IAspectTransaction,
    IAspectOperation,
    OnBlockFinalizeCtx,
    OnBlockInitializeCtx,
    PostContractCallCtx,
    PostTxCommitCtx,
    PostTxExecuteCtx,
    PreContractCallCtx,
    PreTxExecuteCtx,
    OperationCtx,
    ethereum, sys,
} from "@artela/aspect-libs";

/**
 * There are two types of Aspect: Transaction-Level Aspect and Block-Level Aspect.
 * Transaction-Level Aspect will be triggered whenever there is a transaction calling the bound smart contract.
 * Block-Level Aspect will be triggered whenever there is a new block generated.
 *
 * An Aspect can be Transaction-Level, Block-Level,IAspectOperation or both.
 * You can implement corresponding interfaces: IAspectTransaction, IAspectBlock,IAspectOperation or both to tell Artela which
 * type of Aspect you are implementing.
 */
export class Aspect implements IAspectTransaction, IAspectBlock, IAspectOperation {
    /**
     * isOwner is the governance account implemented by the Aspect, when any of the governance operation
     * (including upgrade, config, destroy) is made, isOwner method will be invoked to check
     * against the initiator's account to make sure it has the permission.
     *
     * @param ctx context of Aspect state
     * @param sender address of the operation initiator
     * @return true if check success, false if check fail
     */
    isOwner(sender: string): bool {
        // always return false on isOwner can make the Aspect immutable
        return false;
    }

    /**
     * onContractBinding is an Aspect lifecycle hook, it will be invoked by Aspect Core when
     * a new smart contract is binding to this Aspect. Aspect can choose whether to allow the
     * binding request or not. The binding request will succeed if onContractBinding returns true,
     * otherwise it will fail.
     *
     * @param ctx context of Aspect state
     * @param contractAddr address of the smart contract to binding with current Aspect
     * @return true if binding succeed, otherwise false
     */
    onContractBinding(contractAddr: string): bool {
        return true;
    }


    /**
     * filterTx is a join-point which will be invoked when the mem pool first
     * received the transaction. Since it is a join-point outside the consensus stage,
     * so at this join-point, no state or context can be persisted.
     *
     * @param ctx context of the given join-point
     * @return result of Aspect execution,if false drop tx in mempool
     */
    filterTx(ctx: FilterTxCtx): bool {
        return true
    }

    /**
     * preTxExecute is a join-point which will be invoked before the transaction execution.
     *
     * @param ctx context of the given join-point
     * @return result of Aspect execution
     */
    preTxExecute(ctx: PreTxExecuteCtx): void {
        // Implement me...
    }

    /**
     * preContractCall is a join-point which will be invoked before the contract call is executed.
     *
     * @param ctx context of the given join-point
     * @return result of Aspect execution
     */
    preContractCall(ctx: PreContractCallCtx): void {
        // Get the method of currently called contract.
        const currentCallMethod = ethereum.parseMethodSig(ctx.currentCall.data);

        // Define functions that are not allowed to be reentered.
        const noReentrantMethods : Array<string> = [
            ethereum.computeMethodSig('add_liquidity()'),
            ethereum.computeMethodSig('remove_liquidity()')
        ];

        // Verify if the current method is within the scope of functions that are not susceptible to reentrancy.
        if (noReentrantMethods.includes(currentCallMethod)) {
            // Check if there already exists a non-reentrant method on the current call path.
            let parentIndex = ctx.currentCall.parentIndex;
            // Retrieve the call stack from the context, which refers to
            // all contract calls along the path of the current contract method invocation.
            while (parentIndex >= 0) {
                const parentCall = ctx.trace.findCall(parentIndex)!;
                const parentCallMethod = ethereum.parseMethodSig(parentCall.data);
                if (noReentrantMethods.includes(parentCallMethod)) {
                    // If yes, revert the transaction.
                    sys.revert(`illegal transaction: method reentered from ${currentCallMethod} to ${parentCallMethod}`);
                }
                parentIndex = parentCall.parentIndex;
            }
        }
    }

    /**
     * postContractCall is a join-point which will be invoked after a contract has finished.
     *
     * @param ctx context of the given join-point
     * @return result of Aspect execution
     */
    postContractCall(ctx: PostContractCallCtx): void {
        // Implement me...
    }


    /**
     * postTxExecute is a join-point which will be invoked when the transaction execution is finished but state is not committed.
     *
     * @param ctx context of the given join-point
     * @return result of Aspect execution
     */
    postTxExecute(ctx: PostTxExecuteCtx): void {
        // Implement me...
    }

    /**
     * onTxCommit is a join-point which will be invoked after the state of the transaction is committed.
     *
     * @param ctx context of the given join-point
     * @return result of Aspect execution
     */
    postTxCommit(ctx: PostTxCommitCtx): void {
        // Implement me...
    }


    /**
     * onBlockFinalize is a join-point which will be invoked when a block proposal has been finalized.
     *
     * @param ctx context of the given join-point
     * @return result of Aspect execution
     */
    onBlockFinalize(ctx: OnBlockFinalizeCtx): void {
        // Implement me...
    }


    /**
     * onBlockInitialize is a join-point which will be invoked when a new block proposal is prepared.
     *
     * @param ctx context of the given join-point
     * @return result of Aspect execution
     */
    onBlockInitialize(ctx: OnBlockInitializeCtx): void {
        // Implement me...
    }


    /**
     * operation is a Aspect call.
     *
     * @param ctx  tx input
     * @return result of operation execution
     */
    operation(ctx: OperationCtx, data: Uint8Array): Uint8Array{
        // Implement me...
        return new Uint8Array(0);
    }
}
