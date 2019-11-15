const BN = require('bn.js');
const MathLib = artifacts.require('MathLib.sol');
const StringLib = artifacts.require('StringLib.sol');
const CollateralToken = artifacts.require('CollateralToken');
const PositionToken = artifacts.require('PositionToken');
const DeriveComposer = artifacts.require('DeriveComposer');
const Vat = artifacts.require('Vat');
const NeutralJoin1 = artifacts.require('NeutralJoin1');
const NeutralJoin2 = artifacts.require('NeutralJoin2');
const utility = require('./utility');

contract('DeriveComposer', function(accounts) {
  let derive,
      collateralToken,
      longPositionTokens,
      shortPositionTokens,
      composer,
      vat,
      join1,
      join2;

  let longPositionTokensContract,
      shortPositionTokensContract,
      composerContract,
      join1Contract,
      join2Contract;

  const name = web3.utils.toUtf8(web3.utils.asciiToHex('DING', 32));
  const priceFloor = new BN('50');
  const priceCap = new BN('100');
  const priceDecimalPlaces = new BN('2');
  const qtyMultiplier = new BN('10');
  const expiration = Math.floor(new Date().getTime() / 1000 + 60 * 60 * 24 * 30);
  const fees = new BN('0');
  const qtyToMint = 12;

  beforeEach('Setting up', async () => {
    collateralToken = await CollateralToken.new("Binance USD", "BUSD", 1000000, 18);
    composer = await DeriveComposer.new();
    vat = await Vat.new();
    join1 = await NeutralJoin1.new(vat.address, web3.utils.asciiToHex('DPBUSD', 32), composer.address, collateralToken.address);

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

    await composer.file(web3.utils.asciiToHex('whitelisted', 32), derive.address);
    await composer.file(web3.utils.asciiToHex('neutrals', 32), derive.address, join1.address);

    //INSTANTIATE CONTRACT OBJECTS

    longPositionTokensContract = new web3.eth.Contract(

      PositionToken.abi,
      longPositionTokens.address,

      {from: accounts[0]}

    );

    shortPositionTokensContract = new web3.eth.Contract(

      PositionToken.abi,
      shortPositionTokens.address,

      {from: accounts[0]}

    );

    composerContract = new web3.eth.Contract(

      DeriveComposer.abi,
      composer.address,

      {from: accounts[0]}

    );

    join1Contract = new web3.eth.Contract(

      NeutralJoin1.abi,
      join1.address,

      {from: accounts[0]}

    );

  })

  it('should have correctly set up the contracts', async function() {
    var whitelisting = await composerContract.methods.whitelisted(derive.address).call()
    var neutral = await composerContract.methods.neutrals(derive.address).call()

    var setVat = await join1Contract.methods.vat().call()
    var setIlk= await join1Contract.methods.ilk().call()
    var setCom = await join1Contract.methods.com().call()
    var setDec = await join1Contract.methods.dec().call()
    var setJem = await join1Contract.methods.gem().call()

    var longBalance = await longPositionTokensContract.methods.balanceOf(accounts[1]).call();
    var shortBalance = await shortPositionTokensContract.methods.balanceOf(accounts[1]).call();

    assert(longBalance == 12)
    assert(shortBalance == 12)
    assert(whitelisting.toString() == "true");
    assert(neutral.toString() == join1.address);
    assert(setVat.toString() == vat.address);
    assert(setIlk.toString() == "0x4450425553440000000000000000000000000000000000000000000000000000");
    assert(setCom.toString() == composer.address);
    assert(setDec.toString() == 18);
    assert(setJem.toString() == collateralToken.address)
  })

  it('should join position tokens into a neutral if all conditions are met', async function() {
    await longPositionTokens.approve(composer.address, "-1", {from: accounts[1]})
    await shortPositionTokens.approve(composer.address, "-1", {from: accounts[1]})
    await composer.join(derive.address, 6, {from: accounts[1]})

    var longBalance = await longPositionTokensContract.methods.balanceOf(accounts[1]).call();
    var shortBalance = await shortPositionTokensContract.methods.balanceOf(accounts[1]).call();

    assert(longBalance == 6)
    assert(shortBalance == 6)

    longBalance = await longPositionTokensContract.methods.balanceOf(composer.address).call();
    shortBalance = await shortPositionTokensContract.methods.balanceOf(composer.address).call();

    assert(longBalance == 6)
    assert(shortBalance == 6)

    var contribution = await composerContract.methods.contributions(accounts[1], join1.address).call()
    var minted = await composerContract.methods.minted(accounts[1], join1.address).call()

    assert(minted.toString() == "1800")
    assert(contribution.toString() == "6")

    var joinBalance = await join1Contract.methods.balances(accounts[1]).call()
    var joinLock = await join1Contract.methods.lock(accounts[1]).call()

    assert(joinBalance.toString() == "1800")
    assert(joinLock.toString() == "0")
  })

  it('should exit all positions if all conditions are met', async function() {
    await longPositionTokens.approve(composer.address, "-1", {from: accounts[1]})
    await shortPositionTokens.approve(composer.address, "-1", {from: accounts[1]})
    await composer.join(derive.address, 6, {from: accounts[1]})

    var joinBalance = await join1Contract.methods.balances(accounts[1]).call()

    await composer.exit(derive.address, joinBalance.toString(), {from: accounts[1]})

    var longBalance = await longPositionTokensContract.methods.balanceOf(composer.address).call();
    var shortBalance = await shortPositionTokensContract.methods.balanceOf(composer.address).call();

    assert(longBalance == 0)
    assert(shortBalance == 0)

    longBalance = await longPositionTokensContract.methods.balanceOf(accounts[1]).call();
    shortBalance = await shortPositionTokensContract.methods.balanceOf(accounts[1]).call();

    assert(longBalance == 12)
    assert(shortBalance == 12)

    var joinBalance = await join1Contract.methods.balances(accounts[1]).call()
    var joinLock = await join1Contract.methods.lock(accounts[1]).call()

    assert(joinBalance.toString() == "0")
    assert(joinLock.toString() == "0")

    var contribution = await composerContract.methods.contributions(accounts[1], join1.address).call()
    var minted = await composerContract.methods.minted(accounts[1], join1.address).call()

    assert(minted.toString() == "0")
    assert(contribution.toString() == "0")
  })

  it('should progressively exit positions if all conditions are met', async function() {
    await longPositionTokens.approve(composer.address, "-1", {from: accounts[1]})
    await shortPositionTokens.approve(composer.address, "-1", {from: accounts[1]})
    await composer.join(derive.address, 6, {from: accounts[1]})

    await composer.exit(derive.address, "1600", {from: accounts[1]})

    longBalance = await longPositionTokensContract.methods.balanceOf(composer.address).call();
    shortBalance = await shortPositionTokensContract.methods.balanceOf(composer.address).call();

    console.log(longBalance)

    // assert(longBalance == 0)
    // assert(shortBalance == 0)

    longBalance = await longPositionTokensContract.methods.balanceOf(accounts[1]).call();
    shortBalance = await shortPositionTokensContract.methods.balanceOf(accounts[1]).call();

    console.log(longBalance)

    // assert(longBalance == 12)
    // assert(shortBalance == 12)

    joinBalance = await join1Contract.methods.balances(accounts[1]).call()
    joinLock = await join1Contract.methods.lock(accounts[1]).call()

    console.log(joinBalance)
    console.log(joinLock)

    // assert(joinBalance.toString() == "0")
    // assert(joinLock.toString() == "0")

    contribution = await composerContract.methods.contributions(accounts[1], join1.address).call()
    minted = await composerContract.methods.minted(accounts[1], join1.address).call()

    console.log(contribution)
    console.log(minted)

    // assert(minted.toString() == "0")
    // assert(contribution.toString() == "0")

    await composer.exit(derive.address, "200", {from: accounts[1]})

    longBalance = await longPositionTokensContract.methods.balanceOf(composer.address).call();
    shortBalance = await shortPositionTokensContract.methods.balanceOf(composer.address).call();

    assert(longBalance == 0)
    assert(shortBalance == 0)

    longBalance = await longPositionTokensContract.methods.balanceOf(accounts[1]).call();
    shortBalance = await shortPositionTokensContract.methods.balanceOf(accounts[1]).call();

    assert(longBalance == 12)
    assert(shortBalance == 12)

    joinBalance = await join1Contract.methods.balances(accounts[1]).call()
    joinLock = await join1Contract.methods.lock(accounts[1]).call()

    assert(joinBalance.toString() == "0")
    assert(joinLock.toString() == "0")

    contribution = await composerContract.methods.contributions(accounts[1], join1.address).call()
    minted = await composerContract.methods.minted(accounts[1], join1.address).call()

    assert(minted.toString() == "0")
    assert(contribution.toString() == "0")
  })

})
