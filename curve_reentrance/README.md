
# Curve Contract Reentrancy Guard

## Intro

This is a sample Aspect that can prevent hacks similar to the [reentrant attack happened to Curve.fi on 2023.07](https://fortune.com/crypto/2023/07/31/curve-finance-52-million-hack-hacker-helps-return-funds/).

> Aspect is a new way to build on-chain native extensions. If you are interested about what is Aspect and how Aspect works, please check out our [website](https://www.artela.network/) and [dev guide](https://fanatical-krypton-122.notion.site/Artela-Playground-03c4b7afe0344e7c866cc607e396c0cb) to learn more details.

This is  how the attack happens in short:

1. The attacked Curve.fi pool is written in vyper (another smart contract lang can be compiled into EVM bytecode).
2. The version of vyper they are using is 0.2.15, which is affected by a known reentrant lock issue in the compiler.
3. The attacker bypassed the reentrancy lock by calling `add_liquidity` from `remove_liquidity` through fallback function, which should be blocked by the reentrancy guard but in fact not.

To delve into the attack details, you can check out the attack transaction [here](https://explorer.phalcon.xyz/tx/eth/0xa84aa065ce61dbb1eb50ab6ae67fc31a9da50dd2c74eefd561661bfce2f1620c).

> Learn [How does Aspect Programming prevent reentrancy attacks through on-chain runtime protection](https://github.com/artela-network/example/blob/main/curve_reentrance/README.md).

The example contract and Aspect provided in this repo are mainly the following 3 files:

**contracts/curve.vy**

This is a simplified version of Curve smart contract implemented with vyper. Similar to the Curve pool, it has two methods: `add_liquidity` and `remove_liquidity`, which are both guarded by the same reentrant lock. `AddLiquidity` and `RemoveLiquidity` events will be emitted when corresponding method gets called.

**contracts/attack.sol**

This is a simplified version of attack contract implemented in solidity. It will try to start a reentrant attack through the `remove_liquidity` with its fallback function.

**assembly/aspect/aspect.ts**

This is a runtime reentrant protection Aspect that can detect reentrant attack by checking the callstacks during the transaction execution, and it will revert the transaction immediately if it observed any duplicate calls on the call path.

To reproduce the attack and show how Aspect can protect runtime reentrancy, we have provided 2 files in the `scripts` folder: `curve-reentrancy.cjs` and `curve-reentrancy-with-aspect.cjs`, where,

- `curve-reentrancy.cjs` will deploy the attack contract and Curve contract, and make the attack. You can observe a successful reentrancy by running this script.
- `curve-reentrancy-with-aspect.cjs` will not only do the above steps but also deploy and bind the reentrancy protection Aspect to the Curve contract before the attack. You will observe a reentrancy failure by running this script, since the reentrancy will be stopped by the Aspect.

## Pre-requisites

To reproduce the attack, you need to install solc and vyper (specific version with reentrant lock bug) first

   ```bash
   pip install vyper==0.2.16
   npm install -g solc@0.8.20
   ```

Put your private key hex with some ART in `private.key` file in the root folder. 

## Run

1. Install Nodejs dependencies

    ```bash
   npm install
    ```

2. Build smart contracts and aspects

    ```bash
   npm run build
    ```

3. Execute the re-entrant attack on the simplified Curve contract, and observe the log events in the receipt. If the reentrant attack succeeded, you will see both `AddLiquidity` and `RemoveLiquidity` events logged.

    ```bash
   npm run reentrant:attack
    ```

4. Execute the re-entrant attack on the simplified Curve contract with Aspect protection, and observe the receipt. If the protection succeeded, you will see the transaction gets reverted.

    ```bash
   npm run reentrant:guard
    ```


 
