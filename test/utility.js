const BN = require('bn.js');
const DeriveContractDPX = artifacts.require('DeriveContractDPX');
const Utils = require('web3-utils');

const {
  AbstractMethodFactory,
  GetBlockByNumberMethod,
  AbstractMethod
} = require('web3-core-method');
const { formatters } = require('web3-core-helpers');

module.exports = {
  /**
   * Given a specific set of contract specifications and an execution price, this function returns
   * the needed collateral a user must post in order to execute a trade at that price.
   *
   * @param priceFloor
   * @param priceCap
   * @param qtyMultiplier
   * @param qty
   * @param price
   * @return {number}
   */
  calculateCollateralToReturn(priceFloor, priceCap, qtyMultiplier, qty, price) {
    const zero = 0;
    let maxLoss;
    if (qty > zero) {
      if (price <= priceFloor) {
        maxLoss = zero;
      } else {
        maxLoss = price.sub(priceFloor);
      }
    } else {
      if (price >= priceCap) {
        maxLoss = zero;
      } else {
        maxLoss = priceCap.sub(price);
      }
    }
    return maxLoss.mul(qty.abs()).mul(qtyMultiplier);
  },

  /**
   * Calculate total collateral required for a price range
   *
   * @param {number} priceFloor
   * @param {number} priceCap
   * @param {number} qtyMultiplier
   * @return {number}
   */
  calculateTotalCollateral(priceFloor, priceCap, qtyMultiplier) {
    return priceCap.sub(priceFloor).mul(qtyMultiplier);
  },

  /**
   * Create DeriveContract
   *
   * @param {CollateralToken} collateralToken
   * @param {DeriveCollateralPool} collateralPool
   * @param {string} userAddress
   * @param {string | null} oracleHubAddress
   * @param {number[] | null} contractSpecs
   * @return {DeriveContractDPX}
   */
  createDeriveContract(
    coin,
    collateralToken,
    collateralPool,
    userAddress,
    oracleHubAddress,
    contractSpecs
  ) {
    const expiration = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; // expires in 30 days
    var oracleURL = 'api.coincap.io/v2/rates/usdc';
    const oracleStatistic = 'rateUSD';

    if (!oracleHubAddress) {
      oracleHubAddress = userAddress;
    }

    if (!contractSpecs) {
      contractSpecs = [0, 150, 2, 2, expiration];
    }

    var contractNames = [
      web3.utils.asciiToHex('DING', 32),
      web3.utils.asciiToHex('LDING', 32),
      web3.utils.asciiToHex('SDING', 32)
    ];

    if (coin.toLowerCase() != "ding") {

      oracleURL = 'api.coincap.io/v2/rates/ethereum';
      contractNames = [
        web3.utils.asciiToHex('ETH', 32),
        web3.utils.asciiToHex('LETH', 32),
        web3.utils.asciiToHex('SETH', 32)
      ];

    }

    return DeriveContractDPX.new(
      contractNames,
      [userAddress, collateralToken.address, collateralPool.address],
      oracleHubAddress,
      contractSpecs,
      oracleURL,
      oracleStatistic
    );
  },

  increase(duration) {
    return new EVMManipulator(web3.currentProvider).increase(duration);
  },

  expirationInDays(days) {
    const daysInSeconds = 60 * 60 * 24 * days;
    return Math.round(new Date().getTime() / 1000 + daysInSeconds);
  },

  /**
   * Settle MarketContract
   *
   * @param {DeriveContractMPX} deriveContract
   * @param {number} settlementPrice
   * @param {string} userAddress
   * @return {MarketContractMPX}
   */
  async settleContract(deriveContract, settlementPrice, userAddress) {
    await deriveContract.arbitrateSettlement(settlementPrice, { from: userAddress }); // price above cap!
    return await deriveContract.settlementPrice.call({ from: userAddress });
  },

  async shouldFail(block, message, errorContainsMessage, containsMessage) {
    let error = null;
    try {
      await block();
    } catch (err) {
      error = err;
    }

    assert.instanceOf(error, Error, message);
    if (errorContainsMessage) {
      assert.ok(error.message.includes(errorContainsMessage), containsMessage);
    }
  }
};
