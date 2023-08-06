
import {
    AspectOutput,
    IAspectBlock,
    IAspectTransaction,
    OnAccountVerifyCtx,
    OnBlockFinalizeCtx,
    OnBlockInitializeCtx,
    OnGasPaymentCtx,
    OnTxCommitCtx,
    OnTxReceiveCtx,
    OnTxVerifyCtx,
    PostContractCallCtx,
    PostTxExecuteCtx,
    PreContractCallCtx,
    PreTxExecuteCtx,
    StateCtx,
} from "@artela/aspect-libs";

import { utils } from "@artela/aspect-libs";


/**
 * There are two types of Aspect: Transaction-Level Aspect and Block-Level Aspect.
 * Transaction-Level Aspect will be triggered whenever there is a transaction calling the bound smart contract.
 * Block-Level Aspect will be triggered whenever there is a new block generated.
 * 
 * An Aspect can be Transaction-Level, Block-Level or both.
 * You can implement corresponding interfaces: IAspectTransaction, IAspectBlock or both to tell Artela which
 * type of Aspect you are implementing.
 */
class Aspect implements IAspectTransaction, IAspectBlock {
    /**
     * onTxReceive is a join-point which will be invoked when the mem pool first
     * received the transaction. Since it is a join-point outside the consensus stage,
     * so at this join-point, no state or context can be persisted.
     * 
     * @param ctx context of the given join-point
     * @return result of Aspect execution
     */
    onTxReceive(ctx: OnTxReceiveCtx): AspectOutput {
        return new AspectOutput(true);
    }

    /**
     * onTxVerify is a join-point which will be invoked when verifying the transaction signature,
     * customized verification method can be implemented at this join-point to support features like
     * account abstraction.
     * 
     * @param ctx context of the given join-point
     * @return result of Aspect execution
     */
    onTxVerify(ctx: OnTxVerifyCtx): AspectOutput {
        return new AspectOutput(true);
    }

    /**
     * onAccountVerify is a join-point which will be invoked when verifying the transaction sender account,
     * customized verification method can be implemented at this join-point to support features like
     * account abstraction.
     * 
     * @param ctx context of the given join-point
     * @return result of Aspect execution
     */
    onAccountVerify(ctx: OnAccountVerifyCtx): AspectOutput {
        return new AspectOutput(true);
    }

    /**
     * onGasPayment is a join-point which will be invoked when processing gas fee payment,
     * customized gas fee payment method can be implemented within this join-point.
     * Please note that this join-point is still under development, so currently it will do nothing here.
     * 
     * @param ctx context of the given join-point
     * @return result of Aspect execution
     */
    onGasPayment(ctx: OnGasPaymentCtx): AspectOutput {
        return new AspectOutput(true);
    }

    /**
     * preTxExecute is a join-point which will be invoked before the transaction execution.
     * 
     * @param ctx context of the given join-point
     * @return result of Aspect execution
     */
    preTxExecute(ctx: PreTxExecuteCtx): AspectOutput {
        return new AspectOutput(true);
    }

    /**
     * preContractCall is a join-point which will be invoked before the contract call is executed. 
     * 
     * @param ctx context of the given join-point
     * @return result of Aspect execution
     */
    preContractCall(ctx: PreContractCallCtx): AspectOutput {
        // Get the method of currently called contract.
        let currentCallMethod = utils.praseCallMethod(ctx.currInnerTx!.data);

        // Define functions that are not susceptible to reentrancy.
        // - 0xec45ef89: sig of add__liquidity
        // - 0xe446bfca: sig of remove_liquidity
        let lockMethods = ["0xec45ef89", "0xe446bfca"];

        // Verify if the current method is within the scope of functions that are not susceptible to reentrancy.
        if (lockMethods.includes(currentCallMethod)) {
            // Retrieve the call stack from the context, which refers to
            // all contract calls along the path of the current contract method invocation.
            let rawCallStack = ctx.getCallStack();

            // Create a linked list to encapsulate the raw data of the call stack.
            let callStack = utils.wrapCallStack(rawCallStack);

            // Check if there already exists a non-reentrant method on the current call path.
            callStack = callStack!.parent;
            while (callStack != null) {
                let callStackMethod = utils.praseCallMethod(callStack.data);
                if (lockMethods.includes(callStackMethod)) {
                    // If yes, revert the transaction.
                    ctx.revert("illegal transaction: reentrancy attack");
                }
                callStack = callStack.parent;
            }
        }
        return new AspectOutput(true);
    }

    /**
     * postContractCall is a join-point which will be invoked after a contract has finished.
     * 
     * @param ctx context of the given join-point
     * @return result of Aspect execution
     */
    postContractCall(ctx: PostContractCallCtx): AspectOutput {
        return new AspectOutput(true);
    }

    /**
     * postTxExecute is a join-point which will be invoked when the transaction execution is finished but state is not committed.
     * 
     * @param ctx context of the given join-point
     * @return result of Aspect execution
     */
    postTxExecute(ctx: PostTxExecuteCtx): AspectOutput {
        return new AspectOutput(true);
    }

    /**
     * onTxCommit is a join-point which will be invoked after the state of the transaction is committed.
     * 
     * @param ctx context of the given join-point
     * @return result of Aspect execution
     */
    onTxCommit(ctx: OnTxCommitCtx): AspectOutput {
        return new AspectOutput(true);
    }

    /**
     * onBlockInitialize is a join-point which will be invoked when a new block proposal is prepared.
     * 
     * @param ctx context of the given join-point
     * @return result of Aspect execution
     */
    onBlockInitialize(ctx: OnBlockInitializeCtx): AspectOutput {
        return new AspectOutput(true);
    }

    /**
     * onBlockFinalize is a join-point which will be invoked when a block proposal has been finalized.
     * 
     * @param ctx context of the given join-point
     * @return result of Aspect execution
     */
    onBlockFinalize(ctx: OnBlockFinalizeCtx): AspectOutput {
        return new AspectOutput(true);
    }

    /**
     * isOwner is the governance account implemented by the Aspect, when any of the governance operation
     * (including upgrade, config, destroy) is made, isOwner method will be invoked to check
     * against the initiator's account to make sure it has the permission.
     * 
     * @param ctx context of Aspect state
     * @param sender address of the operation initiator
     * @return true if check success, false if check fail
     */
    isOwner(ctx: StateCtx, initiator: string): bool {
        // always return false on isOwner can make the Aspect immutable
        return true;
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
    onContractBinding(ctx: StateCtx, contractAddr: string): bool {
        return true;
    }
}

export default Aspect;
