"use strict"

const Web3 = require('@artela/web3');
const fs = require("fs");

// load contact abis and bins
const attackBin = '0x' + fs.readFileSync('./build/contract/Attack.bin', "utf-8").toString().trim();
const attackAbi = JSON.parse(fs.readFileSync('./build/contract/Attack.abi', "utf-8"));
const curveBin = fs.readFileSync('./build/contract/CurveContract.bin', "utf-8").toString().trim();
const curveAbi = JSON.parse(fs.readFileSync('./build/contract/CurveContract.abi', "utf-8"));

const defaultGas = 4000000;


async function reentrant() {
    // Step0: prepare the environment
    const web3 = new Web3('http://127.0.0.1:8545');
    const accounts = await web3.atl.getAccounts();
    const curveDeployer = accounts[0]
    const curveNonceVal = await web3.atl.getTransactionCount(curveDeployer);
    const attackDeployer = accounts[1]
    const attackNonceVal = await web3.atl.getTransactionCount(attackDeployer);
    const gasPrice = await web3.atl.getGasPrice();

    // Step1: deploy curve contract to artela
    //
    // curve is an asset management contract that keeps track of the assets owned by users of curve.
    // The total recorded amount of these assets is mapped to the native assets held in the contract's account on the blockchain.
    //
    // Contract at: reentrance/contracts/curve.sol
    console.log("\ncurve contract is deploying...");
    let curveAddress;
    let curveContract = new web3.atl.Contract(curveAbi);
    let curveDeployTx = curveContract.deploy({data: curveBin});
    curveContract = await curveDeployTx
        .send({
            from: curveDeployer,
            nonce: curveNonceVal,
            gas: defaultGas,
            gasPrice
        })
        .on('receipt', function (receipt) {
            curveAddress = receipt.contractAddress;
        });
    console.log("== curve_address ==", curveAddress);
    console.log("== curve_account ==", curveDeployer);
    console.log("curve contract is deployed successfully.");


    // Step2: deploy attack contract to artela
    //
    // The "attach" contract is one of the users of curve and defines the "deposit" and "attach" (withdraw) methods.
    // It use the contract call method to invoke the "deposit" and "withdraw" functions from the curve contract.
    //
    // Contract at: reentrance/contracts/Attack.sol
    console.log("\nattack contract is deploying...")
    let attackAddress;
    let attackContract = new web3.atl.Contract(attackAbi);
    const attackDeployTx = attackContract.deploy({
            data: attackBin,
            arguments: [curveAddress]
        });
    attackContract = await attackDeployTx.send({
        from: attackDeployer,
        nonce: attackNonceVal,
        gas: defaultGas,
        gasPrice
    }).on('receipt', function (receipt) {
        attackAddress = receipt.contractAddress
    });

    console.log("== attack_contract ==", attackAddress);
    console.log("== attack_account ==", attackDeployer);
    console.log("attack contract is deployed successfully.");


    // Step3: deploy Security Aspect
    //
    // Deploy an aspect onto the blockchain with the functionality of
    // checking balances and intercepting transactions according to predefined rules.
    //
    console.log("\nAspect is deploying...")
    let AspectDeployer = accounts[2]
    let nonceValAspectDeployer = await web3.atl.getTransactionCount(AspectDeployer);

    let aspectCode = fs.readFileSync('./build/release.wasm', {
        encoding: "hex"
    });
    let aspect = new web3.atl.Aspect();
    const aspectDeployTx = aspect.deploy({
        data: '0x' + aspectCode,
        properties: [{'key': 'CurveAddr', 'value': curveAddress}, {
            'key': 'binding',
            'value': curveAddress
        }, {'key': 'owner', 'value': AspectDeployer}],
        paymaster: accounts[2],
    });
    aspect = await aspectDeployTx.send({
        from: AspectDeployer,
        nonce: nonceValAspectDeployer,
        gas: defaultGas,
        gasPrice
    });

    let aspectId = aspect.options.address;
    console.log("== aspect address: ==" + aspectId);
    console.log("Aspect is deployed successfully.");
    console.log("\nBinding Aspect with curve contract...");

    // Step4: bind curve contract with the Security Aspect
    //
    // Bind the curve asset management contract, deployed in Step1 (the contract being attacked),
    // to the security check contract deployed in Step5 on the blockchain.
    const curveContractBindTx = curveContract.bind({
        priority: 1,
        aspectId: aspectId,
        aspectVersion: 1,
    });
    await curveContractBindTx.send({
        from: curveDeployer,
        nonce: curveNonceVal + 1,
        gas: defaultGas,
        gasPrice
    }).on('transactionHash', (txHash) => {
        console.log("contract binding tx hash: ", txHash);
    });
    console.log("Successfully bound Aspect with curve contract.")

    console.log("\ntry to remove liquidity without reentrancy...")
    await curveContract.methods.remove_liquidity()
        .send({
            from: curveDeployer,
            nonce: curveNonceVal + 2,
            gas: defaultGas,
            gasPrice,
        })
        .on('transactionHash', (txHash) => {
            console.log("remove liquidity tx hash: ", txHash);
        })
        .on('receipt', function (receipt) {
            console.log(receipt);
        });

    // Step5. call "Attach" contract method "attack"
    //
    // The logic within the attach function will be triggered.
    // Utilizing the code from the curve contract,
    // an attempt is made to bypass the balance restriction and perform a withdrawal activity.
    console.log("\ncalling attack contract... \nremoving liquidity with reentrancy...")
    try {
        await attackContract.methods.attack()
            .send({
                from: accounts[1],
                nonce: attackNonceVal + 1,
                gas: defaultGas,
                gasPrice
            });
        console.log('remove liquidity success with reentrancy!');
    } catch (err) {
        console.log(err);
    }
}

reentrant().catch(err => console.log(err));
