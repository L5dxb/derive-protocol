const MathLib = artifacts.require('MathLib.sol');
const StringLib = artifacts.require('StringLib.sol');
const CollateralToken = artifacts.require('CollateralToken.sol');
const DeriveContractDPX = artifacts.require('DeriveContractDPX.sol');
const DeriveContractFactory = artifacts.require('DeriveContractFactoryDPX.sol');
const DeriveCollateralPool = artifacts.require('DeriveCollateralPool.sol');
const DeriveContractRegistry = artifacts.require('DeriveContractRegistry.sol');
const OracleHub = artifacts.require('OracleHub.sol');
const MockPriceFeed = artifacts.require('MockPriceFeed.sol');

module.exports = async function(deployer, network, accounts) {

  const marketContractExpiration = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; // expires in 30 days

  var collateralPool;
  var localCollateralToken1, localCollateralToken2;
  var oracleHub;
  var marketContractFactory, marketContractRegistry;
  var priceFeed;

  var collateralTokens = [
    "",
    ""
  ]

  await deployer.deploy(StringLib).then(async function() {
  await deployer.deploy(MathLib).then(async function() {
  await deployer.deploy(DeriveContractRegistry).then(async function() {
  await deployer.link(MathLib, [DeriveContractDPX, DeriveCollateralPool, DeriveContractRegistry]).then(async function() {
  await deployer.link(StringLib, DeriveContractDPX).then(async function() {
  await deployer.deploy(DeriveCollateralPool, DeriveContractRegistry.address).then(async function() {

  collateralPool = await DeriveCollateralPool.deployed();

  if (network != 'live') {

    localCollateralToken1 = await deployer.deploy(CollateralToken, 'CollateralToken1', 'CTK1', 10000, 18);
    localCollateralToken2 = await deployer.deploy(CollateralToken, 'CollateralToken2', 'CTK2', 10000, 18);

    collateralTokens[0] = localCollateralToken1.address;
    collateralTokens[1] = localCollateralToken2.address;

    priceFeed = await deployer.deploy(MockPriceFeed);

  } else {}

  oracleHub = await deployer.deploy(OracleHub, priceFeed.address);

  marketContractFactory = await deployer.deploy(DeriveContractFactory, DeriveContractRegistry.address, collateralPool.address, oracleHub.address)
  marketContractRegistry = await DeriveContractRegistry.deployed();

  await marketContractRegistry.addFactoryAddress(marketContractFactory.address)

  var firstDPX = await marketContractFactory.deployDeriveContractDPX(
    [
      web3.utils.asciiToHex('DING', 32),
      web3.utils.asciiToHex('LDING', 32),
      web3.utils.asciiToHex('SDING', 32)
    ],
    collateralTokens[0],
    [
      "900000000000000000",
      "1050000000000000000",
      18,
      100000000,
      marketContractExpiration
    ],
    'api.coincap.io/v2/rates/usdc',
    'rateUsd'
  )

  var secondDPX = await marketContractFactory.deployDeriveContractDPX(
    [
      web3.utils.asciiToHex('ETH', 32),
      web3.utils.asciiToHex('LETH', 32),
      web3.utils.asciiToHex('SETH', 32)
    ],
    collateralTokens[1],
    [
      "170820000000000000000",
      "204820000000000000000",
      18,
      100000000,
      marketContractExpiration
    ],
    'api.coincap.io/v2/rates/ethereum',
    'rateUsd'
  );

  //Setup oracle hub

  await oracleHub.file(
    web3.utils.asciiToHex('feeds', 32),
    firstDPX.receipt.logs[4].args[1],
    0
  )

  await oracleHub.file(
    web3.utils.asciiToHex('feeds', 32),
    secondDPX.receipt.logs[4].args[1],
    1
  )

  await oracleHub.file(
    web3.utils.asciiToHex('fee', 32),
    "2006000000000000"
  )

  }); }); }); }); }); });

}
