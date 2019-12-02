const MathLib = artifacts.require('MathLib.sol');
const StringLib = artifacts.require('StringLib.sol');
const CollateralToken = artifacts.require('CollateralToken.sol');
const ERC20 = artifacts.require('ERC20');
const DeriveContractDPX = artifacts.require('DeriveContractDPX.sol');
const DeriveContractFactory = artifacts.require('DeriveContractFactoryDPX.sol');
const DeriveCollateralPool = artifacts.require('DeriveCollateralPool.sol');
const DerivePools = artifacts.require('DerivePools');
const Vat = artifacts.require('Vat');
const DeriveContractRegistry = artifacts.require('DeriveContractRegistry.sol');
const NeutralJoin1 = artifacts.require('NeutralJoin1');

const HoneycombOracle = artifacts.require('HoneycombOracle.sol');
const HoneycombPriceFeed = artifacts.require('HoneycombPriceFeed.sol');
const LinkTokenInterface = artifacts.require("LinkTokenInterface");

const linkTokenAddress = "0x20fe562d797a42dcb3399062ae9546cd06f63280";
const oracle           = "0x4a3fbbb385b5efeb4bc84a25aaadcd644bd09721";
const jobId = web3.utils.toHex("0baaacb4bc474107933fee4ce403f0f1"); //Coinlayer
const perCallLink = "173000000000000000"
const depositedLink = "2000000000000000000"

module.exports = async function(deployer, network, accounts) {

  const marketContractExpiration = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 60; // expires in 60 days

  var collateralPool;
  var busd;
  var honeycombOracle;
  var marketContractFactory, marketContractRegistry;
  var honeycombPriceFeed;
  var dpbusdJoin;
  var pools;
  var vat;

  var ilk = web3.utils.asciiToHex('DPBUSD', 32);

  console.log("Deploying the infrastructure for derivative markets...")

  await deployer.deploy(StringLib, {from: accounts[0]}).then(async function() {
  await deployer.deploy(MathLib, {from: accounts[0]}).then(async function() {
  await deployer.deploy(DeriveContractRegistry, {from: accounts[0]}).then(async function() {
  await deployer.link(MathLib, [DeriveContractDPX, DeriveCollateralPool, DeriveContractRegistry]).then(async function() {
  await deployer.link(StringLib, DeriveContractDPX, {from: accounts[0]}).then(async function() {
  await deployer.deploy(DeriveCollateralPool, DeriveContractRegistry.address, {from: accounts[0]}).then(async function() {

  console.log("Deploying the collateral pool")

  collateralPool = await DeriveCollateralPool.deployed();

  console.log("Deploying vat")

  vat = await deployer.deploy(Vat, {from: accounts[0]});

  console.log("Deploying BUSD")

  busd = await deployer.deploy(CollateralToken, 'Binance USD', 'BUSD', "100000000000000000000000", 18, {from: accounts[0]});

  console.log("Deploying the neutral pools")

  pools = await deployer.deploy(DerivePools, {from: accounts[0]});

  console.log("Deploying join")

  dpbusdJoin = await deployer.deploy(NeutralJoin1, vat.address, ilk, pools.address, busd.address, {from: accounts[0]});

  //Setup feed and oracle

  console.log("Setting up price feed and oracle")

  honeycombPriceFeed = await deployer.deploy(HoneycombPriceFeed, linkTokenAddress, oracle, jobId, perCallLink, {from: accounts[0]});

  if (network == "ropsten") {

    console.log("Sending LINK to the price feed")

    const linkToken = await ERC20.at(linkTokenAddress);
    await linkToken.transfer(honeycombPriceFeed.address, depositedLink, {from: accounts[0]});

  }

  honeycombOracle = await deployer.deploy(HoneycombOracle, honeycombPriceFeed.address, {from: accounts[0]});

  await honeycombPriceFeed.rely(honeycombOracle.address, {from: accounts[0]});
  await honeycombPriceFeed.deny(accounts[0], {from: accounts[0]});

  //Setup market factory

  console.log("Setting up market factory")

  marketContractFactory = await deployer.deploy(DeriveContractFactory, DeriveContractRegistry.address, collateralPool.address, honeycombOracle.address, {from: accounts[0]})
  marketContractRegistry = await DeriveContractRegistry.deployed();
  await marketContractRegistry.addFactoryAddress(marketContractFactory.address, {from: accounts[0]})

  //Setup Ding market backed by BUSD

  console.log("Creating the first market -- DING")

  var dingDPX = await marketContractFactory.deployDeriveContractDPX(
    [
      web3.utils.asciiToHex('DING', 32),
      web3.utils.asciiToHex('LDING', 32),
      web3.utils.asciiToHex('SDING', 32)
    ],
    busd.address,
    [
      "900000000000000000",
      "1050000000000000000",
      18,
      100000000,
      marketContractExpiration
    ],
    'http://api.coinlayer.com/convert&from=USDT&to=USD&authentication_token=',
    'rateUsd',
    {from: accounts[0]}
  )

  dingDPX = await DeriveContractDPX.at(dingDPX.logs[4].args.contractAddress);

  //Add market underlying ticker in oracle

  console.log("Add market collateral symbol to oracle")

  await honeycombOracle.file(dingDPX.address, "USDT", {from: accounts[0]});

  //Request prices

  if (network == "ropsten") {
    console.log("Requesting the price from the price feed")
    await honeycombOracle.request(dingDPX.address, {from: accounts[0]});
    var pending = await honeycombPriceFeed.processing(dingDPX.address);
    console.log("Waiting for the price update...")
    while(pending.toString() == "true") {
      pending = await honeycombPriceFeed.processing(dingDPX.address);
    }
    console.log("Latest underlying price:")
    var latestPrice = await honeycombPriceFeed.feeds(dingDPX.address)
    console.log(latestPrice.toString())
    console.log("Updating the price in the market contract")
    await honeycombOracle.update(dingDPX.address, {from: accounts[0]})
  }

  //Setup pools

  if (network == "ropsten") {
    console.log("Setting up the neutral pools")
    await pools.file(ilk, web3.utils.asciiToHex('market', 32), dingDPX.address);
    await pools.file(ilk, web3.utils.asciiToHex('custodian', 32), accounts[0]);
    await pools.file(ilk, web3.utils.asciiToHex('join', 32), dpbusdJoin.address);
    await pools.file(ilk, "1000000000000000000");
    await pools.file(0);
  }

  //Mint position tokens

  console.log("Approving collateral and minting positions in the DING market")

  await busd.approve(collateralPool.address, "-1", {from: accounts[0]});
  var mintReceipt = await collateralPool.mintPositionTokens(dingDPX.address, 20, {from: accounts[0]});

  console.log("Approving balances to the pools contract")

  var dingLongToken = await dingDPX.LONG_POSITION_TOKEN();
  dingLongToken = await ERC20.at(dingLongToken);
  var dingShortToken = await dingDPX.SHORT_POSITION_TOKEN();
  dingShortToken = await ERC20.at(dingShortToken);

  await dingLongToken.approve(pools.address, "-1", {from: accounts[0]});
  await dingShortToken.approve(pools.address, "-1", {from: accounts[0]});

  }); }); }); }); }); });

}
