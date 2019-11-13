const BN = require('bn.js');
const CollateralToken = artifacts.require('CollateralToken');
const DeriveCollateralPool = artifacts.require('DeriveCollateralPool');
const DeriveContractRegistry = artifacts.require('DeriveContractRegistry');
const PositionToken = artifacts.require('PositionToken');
const utility = require('./utility.js');

// basic tests to ensure DeriveCollateralPool works and is set up to allow trading
contract('DeriveCollateralPool', function(accounts) {
  let collateralToken;
  let collateralPool;
  let deriveContract;
  let basicDeriveContract;
  let deriveContractRegistry;
  let qtyMultiplier;
  let priceFloor;
  let priceCap;
  let longPositionToken;
  let shortPositionToken;
  let snapshotId;
  let initialCollateralBalance;

  const MarketSides = {
    Long: 0,
    Short: 1,
    Both: 2
  };

  before(async function() {
    deriveContractRegistry = await DeriveContractRegistry.deployed();
  });

  beforeEach(async function() {
    collateralPool = await DeriveCollateralPool.deployed();
    collateralToken = await CollateralToken.deployed();
    deriveContract = await utility.createDeriveContract(
      "ding",
      collateralToken,
      collateralPool,
      accounts[0],
      accounts[0],
      [0, 150, 2, 1, utility.expirationInDays(1)]
    );

    basicDeriveContract = await utility.createDeriveContract(
      "ding",
      collateralToken,
      collateralPool,
      accounts[0],
      accounts[0],
      [0, 150, 2, 2, utility.expirationInDays(1)]
    );

    await deriveContractRegistry.addAddressToWhiteList(deriveContract.address, {
      from: accounts[0]
    });
    await deriveContractRegistry.addAddressToWhiteList(basicDeriveContract.address, {
      from: accounts[0]
    });

    qtyMultiplier = await deriveContract.QTY_MULTIPLIER.call();
    priceFloor = await deriveContract.PRICE_FLOOR.call();
    priceCap = await deriveContract.PRICE_CAP.call();
    longPositionToken = await PositionToken.at(await deriveContract.LONG_POSITION_TOKEN());
    shortPositionToken = await PositionToken.at(await deriveContract.SHORT_POSITION_TOKEN());

    initialCollateralBalance = await collateralToken.balanceOf.call(accounts[0]);
  });

  describe('mintPositionTokens()', function() {
    it('should fail for non whitelisted addresses', async function() {
      // 1. create unregistered contract
      const unregisteredContract = await utility.createDeriveContract(
        "ether",
        collateralToken,
        collateralPool,
        accounts[0]
      );

      // 2. Approve appropriate tokens
      const amountToApprove = new BN('10000000000000000000000'); // 1e22
      await collateralToken.approve(collateralPool.address, amountToApprove, { from: accounts[0] });

      // 3. minting tokens should fail
      let error = null;
      try {
        await collateralPool.mintPositionTokens(unregisteredContract.address, 1, {
          from: accounts[0]
        });
      } catch (err) {
        error = err;
      }
      assert.ok(
        error instanceof Error,
        'should not be able to mint from contracts not whitelisted'
      );
    });

    it('should fail if contract is settled', async function() {
      // 1. force contract to settlement
      await utility.settleContract(deriveContract, priceCap, accounts[0]);

      // 2. approve collateral and mint tokens should fail
      const amountToApprove = new BN('10000000000000000000000'); // 1e22
      await collateralToken.approve(collateralPool.address, amountToApprove);

      await utility.shouldFail(async () => {
        const qtyToMint = 1;
        await collateralPool.mintPositionTokens(deriveContract.address, qtyToMint, {
          from: accounts[0]
        });
      }, 'should not be able to mint position tokens after settlement');
    });

    it('should lock the correct amount of collateral', async function() {
      // 1. approve collateral and mint tokens
      const amountToApprove = new BN('10000000000000000000000'); // 1e22
      await collateralToken.approve(collateralPool.address, amountToApprove);
      const qtyToMint = new BN('100');
      await collateralPool.mintPositionTokens(deriveContract.address, qtyToMint, {
        from: accounts[0]
      });

      // 2. balance after should be equal to expected balance
      const amountToBeLocked = qtyToMint.mul(
        utility.calculateTotalCollateral(priceFloor, priceCap, qtyMultiplier)
      );
      const expectedBalanceAfterMint = initialCollateralBalance.sub(amountToBeLocked);
      const actualBalanceAfterMint = await collateralToken.balanceOf.call(accounts[0]);

      assert.isTrue(
        actualBalanceAfterMint.eq(expectedBalanceAfterMint),
        'incorrect collateral amount locked for minting'
      );
    });
  });

  describe('redeemPositionTokens()', function() {
    it('should fail for non whitelisted addresses', async function() {
      // 1. create unregistered contract
      const unregisteredContract = await utility.createDeriveContract(
        "ding",
        collateralToken,
        collateralPool,
        accounts[0]
      );

      // 2. redeemingPositionTokens should fail for correct reason.
      let error = null;
      try {
        await collateralPool.redeemPositionTokens(unregisteredContract.address, 1, {
          from: accounts[0]
        });
      } catch (err) {
        error = err;
      }

      // TODO: When we upgrade to truffle 5, update test to check for actual failure reason
      assert.ok(
        error instanceof Error,
        'should not be able to mint from contracts not whitelisted'
      );
    });

    it('should redeem token sets and return correct amount of collateral', async function() {
      // 1. approve collateral and mint tokens
      const amountToApprove = new BN('10000000000000000000000'); // 1e22
      await collateralToken.approve(collateralPool.address, amountToApprove);
      const qtyToMint = new BN('100');
      await collateralPool.mintPositionTokens(deriveContract.address, qtyToMint, {
        from: accounts[0]
      });
      const initialLongPosTokenBalance = await longPositionToken.balanceOf.call(accounts[0]);
      const initialShortPosTokenBalance = await shortPositionToken.balanceOf.call(accounts[0]);

      // 2. redeem tokens
      const qtyToRedeem = new BN('50');
      const collateralBalanceBeforeRedeem = await collateralToken.balanceOf.call(accounts[0]);
      await collateralPool.redeemPositionTokens(deriveContract.address, qtyToRedeem, {
        from: accounts[0]
      });

      // 3. assert final tokens balance are as expected
      const expectedFinalLongPosTokenBalance = initialLongPosTokenBalance.sub(qtyToRedeem);
      const expectedFinalShortPosTokenBalance = initialShortPosTokenBalance.sub(qtyToRedeem);
      const finalLongPosTokenBalance = await longPositionToken.balanceOf.call(accounts[0]);
      const finalShortPosTokenBalance = await shortPositionToken.balanceOf.call(accounts[0]);

      assert.isTrue(
        finalLongPosTokenBalance.eq(expectedFinalLongPosTokenBalance),
        'incorrect long position token balance after redeeming'
      );
      assert.isTrue(
        finalShortPosTokenBalance.eq(expectedFinalShortPosTokenBalance),
        'incorrect short position token balance after redeeming'
      );

      // 4. assert correct collateral is returned
      const collateralAmountToBeReleased = qtyToRedeem.mul(
        utility.calculateTotalCollateral(priceFloor, priceCap, qtyMultiplier)
      );
      const expectedCollateralBalanceAfterRedeem = collateralBalanceBeforeRedeem.add(
        collateralAmountToBeReleased
      );
      const actualCollateralBalanceAfterRedeem = await collateralToken.balanceOf.call(accounts[0]);

      assert.isTrue(
        actualCollateralBalanceAfterRedeem.eq(expectedCollateralBalanceAfterRedeem),
        'incorrect collateral amount returned after redeeming'
      );
    });

    it('should fail to redeem single tokens before settlement', async function() {
      // 1. approve collateral and mint tokens
      const amountToApprove = new BN('10000000000000000000000'); // 1e22
      await collateralToken.approve(collateralPool.address, amountToApprove);
      const qtyToMint = new BN('1');
      await collateralPool.mintPositionTokens(deriveContract.address, qtyToMint, {
        from: accounts[0]
      });
      const shortTokenBalance = await shortPositionToken.balanceOf.call(accounts[0]);
      const longTokenBalance = await longPositionToken.balanceOf.call(accounts[0]);
      assert.isTrue(
        shortTokenBalance.eq(longTokenBalance),
        'long token and short token balances are not equals'
      );

      // 2. transfer part of the long token
      await longPositionToken.transfer(accounts[1], qtyToMint, { from: accounts[0] });

      // 3. attempting to redeem all shorts before settlement should fails
      let error = null;
      try {
        const qtyToRedeem = await shortPositionToken.balanceOf.call(accounts[0]);
        await collateralPool.redeemPositionTokens(deriveContract.address, qtyToRedeem, {
          from: accounts[0]
        });
      } catch (err) {
        error = err;
      }

      assert.ok(
        error instanceof Error,
        'should not be able to redeem single tokens before settlement'
      );
    });
  });

  describe('settleAndClose()', function() {
    it('should fail if called before settlement', async () => {
      let settleAndCloseError = null;
      try {
        await collateralPool.settleAndClose(deriveContract.address, 1, 0, { from: accounts[0] });
      } catch (err) {
        settleAndCloseError = err;
      }
      assert.ok(
        settleAndCloseError instanceof Error,
        'settleAndClose() did not fail before settlement'
      );
    });

    it('should fail if user has insufficient tokens', async function() {
      let error = null;

      // 1. approve collateral and mint tokens
      const amountToApprove = new BN('10000000000000000000000'); // 1e22
      await collateralToken.approve(collateralPool.address, amountToApprove);
      const qtyToMint = new BN('1');
      await collateralPool.mintPositionTokens(deriveContract.address, qtyToMint, {
        from: accounts[0]
      });

      // 2. force contract to settlement
      const settlementPrice = await utility.settleContract(
        deriveContract,
        priceCap.sub(new BN('10')),
        accounts[0]
      );

      // 3. attempt to redeem too much long tokens
      const longTokenQtyToRedeem = (await longPositionToken.balanceOf.call(accounts[0])).add(
        new BN('1')
      );
      try {
        await collateralPool.settleAndClose(deriveContract.address, longTokenQtyToRedeem, 0, {
          from: accounts[0]
        });
      } catch (err) {
        error = err;
      }
      assert.instanceOf(error, Error, 'should not be able to redeem insufficient long tokens');

      // 4. attempt to redeem too much short tokens
      error = null;
      const shortTokenQtyToRedeem = (await shortPositionToken.balanceOf.call(accounts[0])).add(
        new BN('1')
      );
      try {
        await collateralPool.settleAndClose(deriveContract.address, 0, shortTokenQtyToRedeem, {
          from: accounts[0]
        });
      } catch (err) {
        error = err;
      }
      assert.instanceOf(error, Error, 'should not be able to redeem insufficient short tokens');
    });

    it('should fail if time not pass settlement delay', async function() {
      let error = null;

      // 1. force contract to settlement
      await utility.settleContract(deriveContract, priceCap.sub(new BN('10')), accounts[0]);

      // 2. move time a little ahead but less than postSettlement < 1 day
      await utility.increase(7000);

      // 3. attempting to redeem token should fail

      await utility.shouldFail(
        async () => {
          const shortTokenQtyToRedeem = new BN('1');
          await collateralPool.settleAndClose(deriveContract.address, 0, shortTokenQtyToRedeem, {
            from: accounts[0]
          });
        },
        'should be able to settle and close',
        'Contract is not past settlement delay',
        'should have for contract not past settlement delay'
      );
    });

    it('should redeem short and long tokens after settlement', async function() {
      let error = null;
      let result = null;

      // 1. approve collateral and mint tokens
      const amountToApprove = new BN('10000000000000000000000'); // 1e22
      await collateralToken.approve(collateralPool.address, amountToApprove);
      const qtyToMint = new BN('1');
      await collateralPool.mintPositionTokens(deriveContract.address, qtyToMint, {
        from: accounts[0]
      });

      // 2. force contract to settlement
      const settlementPrice = await utility.settleContract(
        deriveContract,
        priceCap.sub(new BN('10')),
        accounts[0]
      );
      await utility.increase(87000); // extend time past delay for withdrawal of funds

      // 3. redeem all short position tokens after settlement should pass
      const shortTokenBalanceBeforeRedeem = await shortPositionToken.balanceOf.call(accounts[0]);
      const shortTokenQtyToRedeem = new BN('1');
      try {
        result = await collateralPool.settleAndClose(
          deriveContract.address,
          0,
          shortTokenQtyToRedeem,
          {
            from: accounts[0]
          }
        );
      } catch (err) {
        error = err;
      }
      assert.isNull(error, 'should be able to redeem short tokens after settlement');

      // 4. balance of short tokens should be updated.
      const expectedShortTokenBalanceAfterRedeem = shortTokenBalanceBeforeRedeem.sub(
        shortTokenQtyToRedeem
      );
      const actualShortTokenBalanceAfterRedeem = await shortPositionToken.balanceOf.call(
        accounts[0]
      );
      assert.isTrue(
        actualShortTokenBalanceAfterRedeem.eq(expectedShortTokenBalanceAfterRedeem),
        'short position tokens balance was not reduced'
      );

      // 5. redeem all long position tokens after settlement should pass
      const longTokenBalanceBeforeRedeem = await longPositionToken.balanceOf.call(accounts[0]);
      const longTokenQtyToRedeem = new BN('1');
      error = null;
      result = null;
      try {
        result = await collateralPool.settleAndClose(
          deriveContract.address,
          longTokenQtyToRedeem,
          0,
          {
            from: accounts[0]
          }
        );
      } catch (err) {
        error = err;
      }
      assert.isNull(error, 'should be able to redeem long tokens after settlement');

      // 6. balance of long tokens should be updated.
      const expectedLongTokenBalanceAfterRedeem = longTokenBalanceBeforeRedeem.sub(
        longTokenQtyToRedeem
      );
      const actualLongTokenBalanceAfterRedeem = await longPositionToken.balanceOf.call(accounts[0]);
      assert.isTrue(
        actualLongTokenBalanceAfterRedeem.eq(expectedLongTokenBalanceAfterRedeem),
        'long position tokens balance was not reduced'
      );
    });
  });
});
