"use strict"

const Web3 = require('@artela-next/web3');
const fs = require("fs");

// load contact abis and bins
const attackBin = '0x' + fs.readFileSync('./build/contract/Attack.bin', "utf-8").toString().trim();
const curveBin = fs.readFileSync('./build/contract/CurveContract.bin', "utf-8").toString().trim();
const curveAbi = JSON.parse(fs.readFileSync('./build/contract/CurveContract.abi', "utf-8"));
const attackAbi = JSON.parse(fs.readFileSync('./build/contract/Attack.abi', "utf-8")).concat(curveAbi.filter(item => item.type === 'event'));
const privateKey = fs.readFileSync('./private.key', "utf-8").toString().trim();

const sendOption = {
  gasPrice: '1000000010', // Default gasPrice set by Geth
  gas: 4000000
};

async function reentrant() {
  // init connection to Artela node
  // const web3 = new Web3('https://betanet-rpc1.artela.network');
  const web3 = new Web3('http://127.0.0.1:8545');

  const gasPrice = await web3.eth.getGasPrice();

  sendOption.gasPrice = gasPrice;

  // init accounts
  const sender = web3.eth.accounts.wallet.add(privateKey).address;
  const nonce = await web3.eth.getTransactionCount(sender);

  // Step1: deploy curve contract to artela
  //
  // curve is an asset management contract that keeps track of the assets owned by users of curve.
  // The total recorded amount of these assets is mapped to the native assets held in the contract's account on the blockchain.
  //
  // Contract at: reentrance/contracts/curve.sol
  console.log("\ncurve contract is deploying...");
  let curveAddress;
  const curveContract = await new web3.eth.Contract(curveAbi).deploy({ data: curveBin })
    .send({ from: sender, nonce: nonce, ...sendOption })
    .on('receipt', function (receipt) {
      curveAddress = receipt.contractAddress
    });
  console.log("== curve_address ==", curveAddress);
  console.log("== curve_account ==", sender);
  console.log("curve contract is deployed successfully.");

  // Step2: deploy attack contract to artela
  //
  // The "attach" contract is one of the users of curve and defines the "deposit" and "attach" (withdraw) methods.
  // It use the contract call method to invoke the "deposit" and "withdraw" functions from the curve contract.
  //
  // Contract at: reentrance/contracts/Attack.sol
  console.log("\nattack contract is deploying...")

  let attackAddress;
  let attackContract = await new web3.eth.Contract(attackAbi).deploy(
    { data: attackBin, arguments: [ curveAddress ] }).send({
    from: sender,
    nonce: nonce + 1,
    ...sendOption
  }).on('receipt', function (receipt) {
    attackAddress = receipt.contractAddress
  });

  console.log("== attack_contract ==", attackAddress);
  console.log("== attack_account ==", sender);
  console.log("attack contract is deployed successfully.");

  // wait for block committing
  await new Promise(r => setTimeout(r, 2000));

  // Step3: deploy Security Aspect
  //
  // Deploy an aspect onto the blockchain with the functionality of
  // checking balances and intercepting transactions according to predefined rules.
  //
  console.log("\nAspect is deploying...")
  let aspectCode = fs.readFileSync('./build/release.wasm', {
    encoding: "hex"
  });
  let aspect = new web3.atl.Aspect();
  const aspectDeployCallData = aspect.deploy({
    data: '0x' + aspectCode,
    properties: [],
    paymaster: sender,
    proof: '0x',
    joinPoints: [ 'PreContractCall' ]
  });

  const deployTx = {
    from: sender,
    to: '0x0000000000000000000000000000000000A27E14',
    data: aspectDeployCallData.encodeABI(),
    nonce: nonce + 2,
    gas: await aspectDeployCallData.estimateGas({ from: sender }),
    gasPrice
  }

  let signedTx = await web3.eth.accounts.signTransaction(deployTx, privateKey);
  let receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

  let aspectId = receipt.aspectAddress;
  console.log("== aspect address: ==", aspectId);
  console.log("Aspect is deployed successfully.");
  console.log("\nBinding Aspect with curve contract...");

  // Step4: bind curve contract with the Security Aspect
  //
  // Bind the curve asset management contract, deployed in Step1 (the contract being attacked),
  // to the security check contract deployed in Step5 on the blockchain.
  const curveContractBindCallData = curveContract.bind({
    priority: 1,
    aspectId: aspectId,
    aspectVersion: 1,
  }).encodeABI();

  const curveContractBindTx = {
    from: sender,
    to: '0x0000000000000000000000000000000000A27E14',
    data: curveContractBindCallData,
    nonce: nonce + 3,
    gas: 2000000,
    gasPrice
  }

  signedTx = await web3.eth.accounts.signTransaction(curveContractBindTx, privateKey);
  await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
  console.log("Successfully bound Aspect with curve contract.")

  console.log("\ntry to remove liquidity without reentrancy...")
  await curveContract.methods.remove_liquidity()
    .send({
      from: sender,
      gas: 2000000,
      nonce: nonce + 4,
      gasPrice,
    })
    .on('transactionHash', (txHash) => {
      console.log("remove liquidity tx hash: ", txHash);
    })
    .on('receipt', function (receipt) {
      console.log(receipt);
    });

  // Step3. call "Attack" contract method "attack"
  //
  // The logic within the attack function will be triggered.
  // Utilizing the code from the curve contract,
  // an attempt is made to bypass the balance restriction and perform a withdrawal activity.
  console.log("\ncalling attack...")
  try {
    await attackContract.methods.attack()
      .send({ from: sender, nonce: nonce + 5, ...sendOption })
      .on('receipt', (receipt) => {
        console.log("receipt.events: ", receipt.events);
      })
      .on('transactionHash', (txHash) => {
        console.log("Call contract tx hash: ", txHash);
      });
  } catch (err) {
    console.log(err);
  }
}

reentrant().catch(err => console.log(err));
