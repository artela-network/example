"use strict"

const Web3 = require('@artela/web3');
const fs = require("fs");

// load contact abis and bins
const attackBin = '0x' + fs.readFileSync('./build/contract/Attack.bin', "utf-8").toString().trim();
const attackAbi = JSON.parse(fs.readFileSync('./build/contract/Attack.abi', "utf-8"));
const curveBin = fs.readFileSync('./build/contract/CurveContract.bin', "utf-8").toString().trim();
const curveAbi = JSON.parse(fs.readFileSync('./build/contract/CurveContract.abi', "utf-8"));

const sendOption = {
    gasPrice: '1000000010', // Default gasPrice set by Geth
    gas: 4000000
};


async function reentrant() {
    // init connection to Artela node
    const web3 = new Web3('https://artela-devnet-rpc1.artela.network');

    // retrieve accounts
    let accounts = await web3.atl.getAccounts();

    // retrieve current nonce
    let curveDeployer = accounts[0]
    let curveNonceVal = await web3.atl.getTransactionCount(curveDeployer);


    // Step1: deploy curve contract to artela
    //
    // curve is an asset management contract that keeps track of the assets owned by users of curve.
    // The total recorded amount of these assets is mapped to the native assets held in the contract's account on the blockchain.
    //
    // Contract at: reentrance/contracts/curve.sol
    console.log("\ncurve contract is deploying...");
    let curveAddress;
    let curveContract = await new web3.atl.Contract(curveAbi).deploy({data: curveBin})
        .send({from: curveDeployer, nonce: curveNonceVal, ...sendOption})
        .on('receipt', function (receipt) {
            curveAddress = receipt.contractAddress
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
    let attackDeployer = accounts[1]
    let attackNonceVal = await web3.atl.getTransactionCount(attackDeployer);

    let attackAddress;
    let attackContract = await new web3.atl.Contract(attackAbi).deploy(
        {data: attackBin, arguments: [curveAddress]}).send({
        from: attackDeployer,
        nonce: attackNonceVal,
        ...sendOption
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
    let aspect = await new web3.atl.Aspect().deploy({
        data: '0x' + aspectCode,
        properties: [{'key': 'CurveAddr', 'value': curveAddress}, {
            'key': 'binding',
            'value': curveAddress
        }, {'key': 'owner', 'value': AspectDeployer}]
    }).send({from: AspectDeployer, nonce: nonceValAspectDeployer, ...sendOption});

    console.log("== aspect address: ==" + aspect.options.address);
    console.log("Aspect is deployed successfully.");

    console.log("\nBinding Aspect with curve contract...");
    await new Promise(r => setTimeout(r, 2000));
    let aspectId = aspect.options.address

    // Step4: bind curve contract with the Security Aspect
    //
    // Bind the curve asset management contract, deployed in Step1 (the contract being attacked),
    // to the security check contract deployed in Step5 on the blockchain.
    await curveContract.bind({
        priority: 1,
        aspectId: aspectId,
        aspectVersion: 1,
    }).send({from: curveDeployer, nonce: curveNonceVal + 1})
        .on('transactionHash', (txHash) => {
            console.log("contract binding tx hash: ", txHash);
        });
    console.log("Successfully bound Aspect with curve contract.")

    // wait for block committing
    await new Promise(r => setTimeout(r, 2000));

    // Step5. call "Attach" contract method "attack"
    //
    // The logic within the attach function will be triggered.
    // Utilizing the code from the curve contract,
    // an attempt is made to bypass the balance restriction and perform a withdrawal activity.
    console.log("\ncalling attack...")
    try {
        await attackContract.methods.attack()
            .send({from: accounts[1], nonce: attackNonceVal + 1})
            .on('receipt', (receipt) => {
                console.log("receipt.events: ", receipt.events);
            });
    } catch (err) {
        console.log(err);
    }
}

reentrant().catch(err => console.log(err));
