const DeriveContractDPX = artifacts.require('DeriveContractDPX');
const DeriveContractFactoryDPX = artifacts.require('DeriveContractFactoryDPX');
const CollateralToken = artifacts.require('CollateralToken');
const DeriveContractRegistry = artifacts.require('DeriveContractRegistry');

contract('DeriveContractFactoryDPX', function(accounts) {
  const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50); //expires 50 minutes from now.
  const oracleURL = 'api.coincap.io/v2/rates/usdc';
  const oracleStatistic = 'rateUsd';
  const contractName = [
    web3.utils.asciiToHex('ETHUSD', 32),
    web3.utils.asciiToHex('LETH', 32),
    web3.utils.asciiToHex('SETH', 32)
  ];
  const priceCap = 60465;
  const priceFloor = 20155;
  const priceDecimalPlaces = 2;
  const qtyMultiplier = 10;
  const feesInCollateralToken = 20;
  const feesInMKTToken = 10;

  let deriveContractFactory;
  let deriveContractRegistry;

  before(async function() {
    deriveContractFactory = await DeriveContractFactoryDPX.deployed();
    deriveContractRegistry = await DeriveContractRegistry.deployed();
  });

  it('Allows the registry address to be changed only by the owner', async function() {
    const originalRegistryAddress = await deriveContractFactory.deriveContractRegistry();
    let error = null;
    try {
      await deriveContractFactory.setRegistryAddress(accounts[1], { from: accounts[1] });
    } catch (err) {
      error = err;
    }
    assert.ok(error instanceof Error, 'should not be able to set registry from non-owner account');

    await deriveContractFactory.setRegistryAddress(accounts[1], { from: accounts[0] });

    assert.equal(
      await deriveContractFactory.deriveContractRegistry(),
      accounts[1],
      'did not correctly set the registry address'
    );

    error = null;
    try {
      await deriveContractFactory.setRegistryAddress(null, { from: accounts[0] });
    } catch (err) {
      error = err;
    }
    assert.ok(error instanceof Error, 'should not be able to set registry to null address');

    await deriveContractFactory.setRegistryAddress(originalRegistryAddress, { from: accounts[0] }); // set address back
  });

  it('Allows the oracle hub address to be changed only by the owner', async function() {
    const originalHubAddress = await deriveContractFactory.oracleHub();
    let error = null;
    try {
      await deriveContractFactory.setOracleHubAddress(accounts[1], { from: accounts[1] });
    } catch (err) {
      error = err;
    }
    assert.ok(
      error instanceof Error,
      'should not be able to set the hub address from non-owner account'
    );

    await deriveContractFactory.setOracleHubAddress(accounts[1], { from: accounts[0] });

    assert.equal(
      await deriveContractFactory.oracleHub(),
      accounts[1],
      'did not correctly set the hub address'
    );

    error = null;
    try {
      await deriveContractFactory.setOracleHubAddress(null, { from: accounts[0] });
    } catch (err) {
      error = err;
    }
    assert.ok(error instanceof Error, 'should not be able to set hub to null address');

    await deriveContractFactory.setOracleHubAddress(originalHubAddress, { from: accounts[0] }); // set address back
  });
});
