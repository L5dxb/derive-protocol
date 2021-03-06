// var Web3 = require("web3");
// var BigNumber = require("bignumber.js")
//
// const OracleHub = artifacts.require("OracleHub");
// const MockDeriveContract = artifacts.require("MockDeriveContract");
// const MockPriceFeed = artifacts.require("MockPriceFeed");
//
// const OPTIONS = {
//   defaultBlock: "latest",
//   transactionConfirmationBlocks: 1,
//   transactionBlockTimeout: 5
// };
//
// var web3 = new Web3(
//   new Web3
//   .providers
//   .HttpProvider
//   ("http://localhost:8545"), null, OPTIONS);
//
// contract('OracleHub', async function (accounts) {
//
//   var oracleHub, derive, priceFeed;
//
//   var oracleHubContract, deriveContract, priceFeedContract;
//
//   beforeEach('Setting up', async () => {
//     priceFeed = await MockPriceFeed.new();
//     oracleHub = await OracleHub.new(priceFeed.address);
//     derive = await MockDeriveContract.new(oracleHub.address);
//
//     //INSTANTIATE CONTRACT OBJECTS
//
//     oracleHubContract = new web3.eth.Contract(
//
//       OracleHub.abi,
//       oracleHub.address,
//
//       {from: accounts[0]}
//
//     );
//
//     deriveContract = new web3.eth.Contract(
//
//       MockDeriveContract.abi,
//       derive.address,
//
//       {from: accounts[0]}
//
//     );
//
//     priceFeedContract = new web3.eth.Contract(
//
//       MockPriceFeed.abi,
//       priceFeed.address,
//
//       {from: accounts[0]}
//
//     );
//   })
//
//   it('should be able to setup the hub', async function() {
//     var setOracle = await oracleHubContract.methods.oracle().call();
//
//     assert(setOracle.toString() == priceFeed.address);
//
//     await oracleHub.file(web3.utils.asciiToHex('feeds', 32), derive.address, 1);
//     await oracleHub.file(web3.utils.asciiToHex('fee', 32), "2006000000000000");
//
//     var setFeed = await oracleHubContract.methods.feeds(derive.address).call();
//     var setFee = await oracleHubContract.methods.fee().call();
//
//     assert(setFee.toString() == "2006000000000000")
//     assert(setFeed.toString() == "1")
//   })
//
//   it('should update prices in the feed', async function() {
//     await oracleHub.file(web3.utils.asciiToHex('feeds', 32), derive.address, 1);
//     await oracleHub.file(web3.utils.asciiToHex('fee', 32), "2006000000000000");
//
//     await oracleHub.request({from: accounts[0], value: "2006000000000000"})
//     await oracleHub.complete()
//
//     var priceOne = await priceFeedContract.methods.priceFeed(0).call();
//     var priceTwo = await priceFeedContract.methods.priceFeed(1).call();
//
//     assert(priceOne == "990000000000000000")
//     assert(priceTwo == "187320000000000000000")
//   })
//
//   it('should update the price in a derive contract', async function() {
//     await oracleHub.file(web3.utils.asciiToHex('feeds', 32), derive.address, 1);
//     await oracleHub.update(derive.address);
//     var deriveContractLastPrice = await deriveContract.methods.lastPrice().call();
//     assert(deriveContractLastPrice.toString() == "187320000000000000000");
//   })
//
// })
