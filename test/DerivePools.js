const BN = require('bn.js');
const MathLib = artifacts.require('MathLib.sol');
const StringLib = artifacts.require('StringLib.sol');
const CollateralToken = artifacts.require('CollateralToken');
const PositionToken = artifacts.require('PositionToken');
const DerivePools = artifacts.require('DerivePools');
const Vat = artifacts.require('Vat');
const NeutralJoin1 = artifacts.require('NeutralJoin1');

const utility = require('./utility');

contract('DerivePools', function(accounts) {
  let derive,
      collateralToken,
      longPositionTokens,
      shortPositionTokens,
      pools,
      vat,
      join;

  let longPositionTokensContract,
      shortPositionTokensContract,
      poolsContract,
      vatContract,
      joinContract;

  const name = web3.utils.toUtf8(web3.utils.asciiToHex('DING', 32));
  const priceFloor = new BN('50');
  const priceCap = new BN('100');
  const priceDecimalPlaces = new BN('2');
  const qtyMultiplier = new BN('10');
  const expiration = Math.floor(new Date().getTime() / 1000 + 60 * 60 * 24 * 30);
  const fees = new BN('0');
  const qtyToMint = 12;

  const longHolderPrivKey1 = "0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1";
  const shortHolderPrivKey1 = "0x6370fd033278c143179d81c5526140625662b8daa446c22ee2d73db3707e620c";

  const longHolderPrivKey2 = "0x646f1ce2fdad0e6deeeb5c7e8e5543bdde65e86029e2fd9fc169899c440a7913";
  const shortHolderPrivKey2 = "0xadd53f9a7e588d003326d1cbf9e4a43c061aadd9bc938c843a79e7b4fd2ad743";

  beforeEach('Setting up', async () => {
    collateralToken = await CollateralToken.new("Binance USD", "BUSD", 1000000, 18);
    vat = await Vat.new();
    pools = await DerivePools.new();
    join = await NeutralJoin1.new(vat.address, web3.utils.asciiToHex('DPBUSD', 32), pools.address, collateralToken.address);

    derive = await utility.createDeriveContract(
      "ding",
      collateralToken,
      { address: accounts[0] }, // setting first account as collateral pool
      accounts[0]
    );

    longPositionTokens = await PositionToken.at(await derive.LONG_POSITION_TOKEN());
    shortPositionTokens = await PositionToken.at(
      await derive.SHORT_POSITION_TOKEN()
    );

    await derive.mintPositionTokens(qtyToMint, accounts[1], { from: accounts[0] });
    await derive.mintPositionTokens(qtyToMint, accounts[2], { from: accounts[0] });
    await derive.mintPositionTokens(qtyToMint, accounts[3], { from: accounts[0] });
    await derive.mintPositionTokens(qtyToMint, accounts[4], { from: accounts[0] });

    await pools.file(web3.utils.asciiToHex('DPBUSD', 32), web3.utils.asciiToHex('market', 32), derive.address);
    await pools.file(web3.utils.asciiToHex('DPBUSD', 32), web3.utils.asciiToHex('custodian', 32), accounts[3]);
    await pools.file(web3.utils.asciiToHex('DPBUSD', 32), web3.utils.asciiToHex('join', 32), join.address);

    await pools.file(web3.utils.asciiToHex('DPBUSD', 32), 100000000000000);
    await pools.file(120);

    //INSTANTIATE CONTRACT OBJECTS

    longPositionTokensContract = new web3.eth.Contract(

      PositionToken.abi,
      longPositionTokens.address,

      {from: accounts[0]}

    );

    vatContract = new web3.eth.Contract(

      Vat.abi,
      vat.address,

      {from: accounts[0]}

    );

    shortPositionTokensContract = new web3.eth.Contract(

      PositionToken.abi,
      shortPositionTokens.address,

      {from: accounts[0]}

    );

    poolsContract = new web3.eth.Contract(

      DerivePools.abi,
      pools.address,

      {from: accounts[0]}

    );

    joinContract = new web3.eth.Contract(

      NeutralJoin1.abi,
      join.address,

      {from: accounts[0]}

    );

  })

  it('should join a valid long/short pair', async function() {

    //Create long signature and hash
    var longHash = await poolsContract.methods.getData(web3.utils.asciiToHex('transfer', 32), pools.address, 10).call()
    longHash = await poolsContract.methods.getHash(accounts[1], longPositionTokens.address, 0, longHash).call()
    var longSignature = web3.eth.accounts.sign(longHash, longHolderPrivKey1);

    //Create short signature and hash
    var shortHash = await poolsContract.methods.getData(web3.utils.asciiToHex('transfer', 32), pools.address, 10).call()
    shortHash = await poolsContract.methods.getHash(accounts[2], shortPositionTokens.address, 0, shortHash).call()
    var shortSignature = web3.eth.accounts.sign(shortHash, shortHolderPrivKey1);

    //Approve transfers
    await longPositionTokens.approve(pools.address, "-1", {from: accounts[1]});
    await shortPositionTokens.approve(pools.address, "-1", {from: accounts[2]});

    //Pack vars
    var packedLong = await poolsContract.methods.flipCompose(true, longSignature.signature, accounts[1], 10).call()
    var packedShort = await poolsContract.methods.flipCompose(false, shortSignature.signature, accounts[2], 10).call()

    await pools.flip(
      [packedLong],
      [packedShort],
      web3.utils.asciiToHex('DPBUSD', 32),
      true
    )

    var poolsLongBalance = await longPositionTokensContract.methods.balanceOf(pools.address).call();
    var poolsShortBalance = await shortPositionTokensContract.methods.balanceOf(pools.address).call();

    assert(poolsLongBalance.toString() == poolsShortBalance.toString())

    var longInternalBalance = await poolsContract.methods.balances(accounts[1], web3.utils.asciiToHex('DPBUSD', 32), longPositionTokens.address).call()
    var shortInternalBalance = await poolsContract.methods.balances(accounts[2], web3.utils.asciiToHex('DPBUSD', 32), shortPositionTokens.address).call()

    assert(longInternalBalance.toString() == shortInternalBalance.toString())
    assert(longInternalBalance.toString() == "10")

    var longCooldown = await poolsContract.methods.cooldown(accounts[1], web3.utils.asciiToHex('DPBUSD', 32)).call();
    var shortCooldown = await poolsContract.methods.cooldown(accounts[2], web3.utils.asciiToHex('DPBUSD', 32)).call();

    assert(longCooldown.toString() == shortCooldown.toString())
    assert(longCooldown.toString() != "0")

    var neutral = await poolsContract.methods.neutrals(web3.utils.asciiToHex('DPBUSD', 32)).call();

    assert(neutral.matched.toString() == "3000")

    var gem = await vatContract.methods.gem(web3.utils.asciiToHex('DPBUSD', 32), accounts[3]).call();

    assert(gem.toString() == "3000")

  })

  it('should exit a valid long/short pair', async function() {

    await createSimpleNeutral();

    var longExitHash = await poolsContract.methods.getData(web3.utils.asciiToHex('transferFrom', 32), accounts[1], 10).call()
    longExitHash = await poolsContract.methods.getHash(accounts[1], longPositionTokens.address, 0, longExitHash).call()
    var longExitSignature = web3.eth.accounts.sign(longExitHash, longHolderPrivKey1);

    var shortExitHash = await poolsContract.methods.getData(web3.utils.asciiToHex('transferFrom', 32), accounts[2], 10).call()
    shortExitHash = await poolsContract.methods.getHash(accounts[2], shortPositionTokens.address, 0, shortExitHash).call()
    var shortExitSignature = web3.eth.accounts.sign(shortExitHash, shortHolderPrivKey1);

    //Pack vars
    var packedLong = await poolsContract.methods.flipCompose(true, longExitSignature.signature, accounts[1], 10).call()
    var packedShort = await poolsContract.methods.flipCompose(false, shortExitSignature.signature, accounts[2], 10).call()

    await pools.flip(
      [packedLong],
      [packedShort],
      web3.utils.asciiToHex('DPBUSD', 32),
      false
    )

    var poolsLongBalance = await longPositionTokensContract.methods.balanceOf(pools.address).call();
    var poolsShortBalance = await shortPositionTokensContract.methods.balanceOf(pools.address).call();

    assert(poolsLongBalance.toString() == poolsShortBalance.toString());
    assert(poolsLongBalance.toString() == "0");

    var longInternalBalance = await poolsContract.methods.balances(accounts[1], web3.utils.asciiToHex('DPBUSD', 32), longPositionTokens.address).call()
    var shortInternalBalance = await poolsContract.methods.balances(accounts[2], web3.utils.asciiToHex('DPBUSD', 32), shortPositionTokens.address).call()

    assert(longInternalBalance.toString() == shortInternalBalance.toString());
    assert(longInternalBalance.toString() == "0");

    var longCooldown = await poolsContract.methods.cooldown(accounts[1], web3.utils.asciiToHex('DPBUSD', 32)).call();
    var shortCooldown = await poolsContract.methods.cooldown(accounts[2], web3.utils.asciiToHex('DPBUSD', 32)).call();

    assert(longCooldown.toString() == shortCooldown.toString());
    assert(longCooldown.toString() == "0");

    var neutral = await poolsContract.methods.neutrals(web3.utils.asciiToHex('DPBUSD', 32)).call();

    assert(neutral.matched.toString() == "0");

    var gem = await vatContract.methods.gem(web3.utils.asciiToHex('DPBUSD', 32), accounts[3]).call();

    assert(gem.toString() == "0");

  })

  it('should entirely swap a long position', async function() {

    await createSimpleNeutral();

    //Swap sigs and data

    var longExitHash = await poolsContract.methods.getData(web3.utils.asciiToHex('transferFrom', 32), accounts[1], 10).call()
    longExitHash = await poolsContract.methods.getHash(accounts[1], longPositionTokens.address, 0, longExitHash).call()
    var longExitSignature = web3.eth.accounts.sign(longExitHash, longHolderPrivKey1);

    var longNewJoinHash = await poolsContract.methods.getData(web3.utils.asciiToHex('transfer', 32), accounts[2], 10).call()
    longNewJoinHash = await poolsContract.methods.getHash(accounts[2], longPositionTokens.address, 0, longNewJoinHash).call()
    var longNewJoinSignature = web3.eth.accounts.sign(longNewJoinHash, shortHolderPrivKey1);

    //Approve transfers
    await longPositionTokens.approve(pools.address, "-1", {from: accounts[2]});
    await shortPositionTokens.approve(pools.address, "-1", {from: accounts[1]});

    //Pack data
    var packedJoin = await poolsContract.methods.swapCompose(longNewJoinSignature.signature, accounts[2], 10).call()

    await pools.swap(
      web3.utils.asciiToHex('DPBUSD', 32),
      longExitSignature.signature,
      accounts[1],
      [packedJoin],
      10,
      true
    );

    var poolsLongBalance = await longPositionTokensContract.methods.balanceOf(pools.address).call();
    var poolsShortBalance = await shortPositionTokensContract.methods.balanceOf(pools.address).call();

    assert(poolsLongBalance.toString() == poolsShortBalance.toString());
    assert(poolsLongBalance.toString() == "10");

    var longInternalBalanceExiter = await poolsContract.methods.balances(accounts[1], web3.utils.asciiToHex('DPBUSD', 32), longPositionTokens.address).call()
    var longInternalBalanceJoiner = await poolsContract.methods.balances(accounts[2], web3.utils.asciiToHex('DPBUSD', 32), longPositionTokens.address).call()

    assert(longInternalBalanceJoiner.toString() == '10');
    assert(longInternalBalanceExiter.toString() == "0");

    var neutral = await poolsContract.methods.neutrals(web3.utils.asciiToHex('DPBUSD', 32)).call();

    assert(neutral.matched.toString() == "3000");

    var gem = await vatContract.methods.gem(web3.utils.asciiToHex('DPBUSD', 32), accounts[3]).call();

    assert(gem.toString() == "3000");

  })

  it('should entirely swap a short position', async function() {

    await createSimpleNeutral();

    //Swap sigs and data

    var shortExitHash = await poolsContract.methods.getData(web3.utils.asciiToHex('transferFrom', 32), accounts[2], 10).call()
    shortExitHash = await poolsContract.methods.getHash(accounts[2], shortPositionTokens.address, 0, shortExitHash).call()
    var shortExitSignature = web3.eth.accounts.sign(shortExitHash, shortHolderPrivKey1);

    var shortNewJoinHash = await poolsContract.methods.getData(web3.utils.asciiToHex('transfer', 32), accounts[1], 10).call()
    shortNewJoinHash = await poolsContract.methods.getHash(accounts[1], shortPositionTokens.address, 0, shortNewJoinHash).call()
    var shortNewJoinSignature = web3.eth.accounts.sign(shortNewJoinHash, longHolderPrivKey1);

    //Approve transfers
    await longPositionTokens.approve(pools.address, "-1", {from: accounts[2]});
    await shortPositionTokens.approve(pools.address, "-1", {from: accounts[1]});

    //Approve transfers
    // await longPositionTokens.approve(pools.address, "-1", {from: accounts[2]});
    // await shortPositionTokens.approve(pools.address, "-1", {from: accounts[1]});

    //Pack data
    var packedJoin = await poolsContract.methods.swapCompose(shortNewJoinSignature.signature, accounts[1], 10).call()

    await pools.swap(
      web3.utils.asciiToHex('DPBUSD', 32),
      shortExitSignature.signature,
      accounts[2],
      [packedJoin],
      10,
      false
    );

    var poolsLongBalance = await longPositionTokensContract.methods.balanceOf(pools.address).call();
    var poolsShortBalance = await shortPositionTokensContract.methods.balanceOf(pools.address).call();

    assert(poolsLongBalance.toString() == poolsShortBalance.toString());
    assert(poolsLongBalance.toString() == "10");

    var shortInternalBalanceJoiner = await poolsContract.methods.balances(accounts[1], web3.utils.asciiToHex('DPBUSD', 32), shortPositionTokens.address).call()
    var shortInternalBalanceExiter = await poolsContract.methods.balances(accounts[2], web3.utils.asciiToHex('DPBUSD', 32), shortPositionTokens.address).call()

    assert(shortInternalBalanceJoiner.toString() == '10');
    assert(shortInternalBalanceExiter.toString() == "0");

    var neutral = await poolsContract.methods.neutrals(web3.utils.asciiToHex('DPBUSD', 32)).call();

    assert(neutral.matched.toString() == "3000");

    var gem = await vatContract.methods.gem(web3.utils.asciiToHex('DPBUSD', 32), accounts[3]).call();

    assert(gem.toString() == "3000");

  })

  it('should create neutrals with multiple orders on both sides', async function() {
    //Create long signatures and hashes
    var longHash1 = await poolsContract.methods.getData(web3.utils.asciiToHex('transfer', 32), pools.address, 10).call()
    longHash1 = await poolsContract.methods.getHash(accounts[1], longPositionTokens.address, 0, longHash1).call()
    var longSignature1 = web3.eth.accounts.sign(longHash1, longHolderPrivKey1);

    var longHash2 = await poolsContract.methods.getData(web3.utils.asciiToHex('transfer', 32), pools.address, 10).call()
    longHash2 = await poolsContract.methods.getHash(accounts[3], longPositionTokens.address, 0, longHash2).call()
    var longSignature2 = web3.eth.accounts.sign(longHash2, longHolderPrivKey2);

    //Create short signatures and hashes
    var shortHash1 = await poolsContract.methods.getData(web3.utils.asciiToHex('transfer', 32), pools.address, 10).call()
    shortHash1 = await poolsContract.methods.getHash(accounts[2], shortPositionTokens.address, 0, shortHash1).call()
    var shortSignature1 = web3.eth.accounts.sign(shortHash1, shortHolderPrivKey1);

    var shortHash2 = await poolsContract.methods.getData(web3.utils.asciiToHex('transfer', 32), pools.address, 10).call()
    shortHash2 = await poolsContract.methods.getHash(accounts[4], shortPositionTokens.address, 0, shortHash2).call()
    var shortSignature2 = web3.eth.accounts.sign(shortHash2, shortHolderPrivKey2);

    //Approve transfers
    await longPositionTokens.approve(pools.address, "-1", {from: accounts[1]});
    await longPositionTokens.approve(pools.address, "-1", {from: accounts[3]});
    await shortPositionTokens.approve(pools.address, "-1", {from: accounts[2]});
    await shortPositionTokens.approve(pools.address, "-1", {from: accounts[4]});

    //Pack vars
    var packedLong1 = await poolsContract.methods.flipCompose(true, longSignature1.signature, accounts[1], 10).call()
    var packedLong2 = await poolsContract.methods.flipCompose(true, longSignature2.signature, accounts[3], 10).call()
    var packedShort1 = await poolsContract.methods.flipCompose(false, shortSignature1.signature, accounts[2], 10).call()
    var packedShort2 = await poolsContract.methods.flipCompose(false, shortSignature2.signature, accounts[4], 10).call()

    await pools.flip(
      [packedLong1, packedLong2],
      [packedShort1, packedShort2],
      web3.utils.asciiToHex('DPBUSD', 32),
      true
    );

    var poolsLongBalance = await longPositionTokensContract.methods.balanceOf(pools.address).call();
    var poolsShortBalance = await shortPositionTokensContract.methods.balanceOf(pools.address).call();

    assert(poolsLongBalance.toString() == poolsShortBalance.toString())

    var longInternalBalance1 = await poolsContract.methods.balances(accounts[1], web3.utils.asciiToHex('DPBUSD', 32), longPositionTokens.address).call()
    var longInternalBalance2 = await poolsContract.methods.balances(accounts[3], web3.utils.asciiToHex('DPBUSD', 32), longPositionTokens.address).call()
    var shortInternalBalance1 = await poolsContract.methods.balances(accounts[2], web3.utils.asciiToHex('DPBUSD', 32), shortPositionTokens.address).call()
    var shortInternalBalance2 = await poolsContract.methods.balances(accounts[4], web3.utils.asciiToHex('DPBUSD', 32), shortPositionTokens.address).call()

    assert(longInternalBalance1.toString() == shortInternalBalance1.toString())
    assert(longInternalBalance2.toString() == shortInternalBalance2.toString())

    assert(longInternalBalance1.toString() == "10")
    assert(longInternalBalance2.toString() == "10")

    var longCooldown1 = await poolsContract.methods.cooldown(accounts[1], web3.utils.asciiToHex('DPBUSD', 32)).call();
    var longCooldown2 = await poolsContract.methods.cooldown(accounts[3], web3.utils.asciiToHex('DPBUSD', 32)).call();
    var shortCooldown1 = await poolsContract.methods.cooldown(accounts[2], web3.utils.asciiToHex('DPBUSD', 32)).call();
    var shortCooldown2 = await poolsContract.methods.cooldown(accounts[4], web3.utils.asciiToHex('DPBUSD', 32)).call();

    assert(longCooldown1.toString() == shortCooldown1.toString())
    assert(longCooldown2.toString() == shortCooldown2.toString())
    assert(longCooldown1.toString() != "0")
    assert(longCooldown2.toString() != "0")

    var neutral = await poolsContract.methods.neutrals(web3.utils.asciiToHex('DPBUSD', 32)).call();

    assert(neutral.matched.toString() == "6000")

    var gem = await vatContract.methods.gem(web3.utils.asciiToHex('DPBUSD', 32), accounts[3]).call();

    assert(gem.toString() == "6000")
  })

  it('should swap with multiple joiners', async function() {
    await createMultiNeutral();

    //Swap sigs and data

    var shortExitHash = await poolsContract.methods.getData(web3.utils.asciiToHex('transferFrom', 32), accounts[2], 10).call()
    shortExitHash = await poolsContract.methods.getHash(accounts[2], shortPositionTokens.address, 0, shortExitHash).call()
    var shortExitSignature = web3.eth.accounts.sign(shortExitHash, shortHolderPrivKey1);

    var shortNewJoinHash1 = await poolsContract.methods.getData(web3.utils.asciiToHex('transfer', 32), accounts[1], 5).call()
    shortNewJoinHash1 = await poolsContract.methods.getHash(accounts[1], shortPositionTokens.address, 0, shortNewJoinHash1).call()
    var shortNewJoinSignature1 = web3.eth.accounts.sign(shortNewJoinHash1, longHolderPrivKey1);

    var shortNewJoinHash2 = await poolsContract.methods.getData(web3.utils.asciiToHex('transfer', 32), accounts[3], 5).call()
    shortNewJoinHash2 = await poolsContract.methods.getHash(accounts[3], shortPositionTokens.address, 0, shortNewJoinHash2).call()
    var shortNewJoinSignature2 = web3.eth.accounts.sign(shortNewJoinHash2, longHolderPrivKey2);

    //Approve transfers
    await longPositionTokens.approve(pools.address, "-1", {from: accounts[2]});
    await longPositionTokens.approve(pools.address, "-1", {from: accounts[4]});
    await shortPositionTokens.approve(pools.address, "-1", {from: accounts[1]});
    await shortPositionTokens.approve(pools.address, "-1", {from: accounts[3]});

    //Pack data
    var packedJoin1 = await poolsContract.methods.swapCompose(shortNewJoinSignature1.signature, accounts[1], 5).call()
    var packedJoin2 = await poolsContract.methods.swapCompose(shortNewJoinSignature2.signature, accounts[3], 5).call()

    await pools.swap(
      web3.utils.asciiToHex('DPBUSD', 32),
      shortExitSignature.signature,
      accounts[2],
      [packedJoin1, packedJoin2],
      10,
      false
    );

    var poolsLongBalance = await longPositionTokensContract.methods.balanceOf(pools.address).call();
    var poolsShortBalance = await shortPositionTokensContract.methods.balanceOf(pools.address).call();

    assert(poolsLongBalance.toString() == poolsShortBalance.toString())

    var shortInternalBalance1 = await poolsContract.methods.balances(accounts[1], web3.utils.asciiToHex('DPBUSD', 32), shortPositionTokens.address).call()
    var shortInternalBalance2 = await poolsContract.methods.balances(accounts[2], web3.utils.asciiToHex('DPBUSD', 32), shortPositionTokens.address).call()
    var shortInternalBalance3 = await poolsContract.methods.balances(accounts[3], web3.utils.asciiToHex('DPBUSD', 32), shortPositionTokens.address).call()
    var shortInternalBalance4 = await poolsContract.methods.balances(accounts[4], web3.utils.asciiToHex('DPBUSD', 32), shortPositionTokens.address).call()

    assert(shortInternalBalance1.toString() == "5");
    assert(shortInternalBalance2.toString() == "0");
    assert(shortInternalBalance3.toString() == "5")
    assert(shortInternalBalance4.toString() == "10")

    var neutral = await poolsContract.methods.neutrals(web3.utils.asciiToHex('DPBUSD', 32)).call();

    assert(neutral.matched.toString() == "6000")

    var gem = await vatContract.methods.gem(web3.utils.asciiToHex('DPBUSD', 32), accounts[3]).call();

    assert(gem.toString() == "6000")
  })

  async function createSimpleNeutral() {
    await pools.file(0);

    //Create long signature and hash
    var longHash = await poolsContract.methods.getData(web3.utils.asciiToHex('transfer', 32), pools.address, 10).call()
    longHash = await poolsContract.methods.getHash(accounts[1], longPositionTokens.address, 0, longHash).call()
    var longSignature = web3.eth.accounts.sign(longHash, longHolderPrivKey1);

    //Create short signature and hash
    var shortHash = await poolsContract.methods.getData(web3.utils.asciiToHex('transfer', 32), pools.address, 10).call()
    shortHash = await poolsContract.methods.getHash(accounts[2], shortPositionTokens.address, 0, shortHash).call()
    var shortSignature = web3.eth.accounts.sign(shortHash, shortHolderPrivKey1);

    //Approve transfers
    await longPositionTokens.approve(pools.address, "-1", {from: accounts[1]});
    await shortPositionTokens.approve(pools.address, "-1", {from: accounts[2]});

    //Pack vars
    var packedLong = await poolsContract.methods.flipCompose(true, longSignature.signature, accounts[1], 10).call()
    var packedShort = await poolsContract.methods.flipCompose(false, shortSignature.signature, accounts[2], 10).call()

    await pools.flip(
      [packedLong],
      [packedShort],
      web3.utils.asciiToHex('DPBUSD', 32),
      true
    );
  }

  async function createMultiNeutral() {
    await pools.file(0);

    //Create long signatures and hashes
    var longHash1 = await poolsContract.methods.getData(web3.utils.asciiToHex('transfer', 32), pools.address, 10).call()
    longHash1 = await poolsContract.methods.getHash(accounts[1], longPositionTokens.address, 0, longHash1).call()
    var longSignature1 = web3.eth.accounts.sign(longHash1, longHolderPrivKey1);

    var longHash2 = await poolsContract.methods.getData(web3.utils.asciiToHex('transfer', 32), pools.address, 10).call()
    longHash2 = await poolsContract.methods.getHash(accounts[3], longPositionTokens.address, 0, longHash2).call()
    var longSignature2 = web3.eth.accounts.sign(longHash2, longHolderPrivKey2);

    //Create short signatures and hashes
    var shortHash1 = await poolsContract.methods.getData(web3.utils.asciiToHex('transfer', 32), pools.address, 10).call()
    shortHash1 = await poolsContract.methods.getHash(accounts[2], shortPositionTokens.address, 0, shortHash1).call()
    var shortSignature1 = web3.eth.accounts.sign(shortHash1, shortHolderPrivKey1);

    var shortHash2 = await poolsContract.methods.getData(web3.utils.asciiToHex('transfer', 32), pools.address, 10).call()
    shortHash2 = await poolsContract.methods.getHash(accounts[4], shortPositionTokens.address, 0, shortHash2).call()
    var shortSignature2 = web3.eth.accounts.sign(shortHash2, shortHolderPrivKey2);

    //Approve transfers
    await longPositionTokens.approve(pools.address, "-1", {from: accounts[1]});
    await longPositionTokens.approve(pools.address, "-1", {from: accounts[3]});
    await shortPositionTokens.approve(pools.address, "-1", {from: accounts[2]});
    await shortPositionTokens.approve(pools.address, "-1", {from: accounts[4]});

    //Pack vars
    var packedLong1 = await poolsContract.methods.flipCompose(true, longSignature1.signature, accounts[1], 10).call()
    var packedLong2 = await poolsContract.methods.flipCompose(true, longSignature2.signature, accounts[3], 10).call()
    var packedShort1 = await poolsContract.methods.flipCompose(false, shortSignature1.signature, accounts[2], 10).call()
    var packedShort2 = await poolsContract.methods.flipCompose(false, shortSignature2.signature, accounts[4], 10).call()

    await pools.flip(
      [packedLong1, packedLong2],
      [packedShort1, packedShort2],
      web3.utils.asciiToHex('DPBUSD', 32),
      true
    );
  }

})
