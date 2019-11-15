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
  let derive1,
      derive2,
      collateralToken1,
      collateralToken2,
      longPositionTokens1,
      shortPositionTokens1,
      longPositionTokens2,
      shortPositionTokens2,
      composer,
      vat,
      join1,
      join2;

  let longPositionTokensContract1,
      shortPositionTokensContract1,
      longPositionTokensContract2,
      shortPositionTokensContract2,
      composerContract,
      vatContract,
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
    collateralToken1 = await CollateralToken.new("Binance USD", "BUSD", 1000000, 18);
    collateralToken2 = await CollateralToken.new("USD Coin", "USDC", 1000000, 6);
    vat = await Vat.new();
    composer = await DeriveComposer.new(vat.address);
    join1 = await NeutralJoin1.new(vat.address, web3.utils.asciiToHex('DPBUSD', 32), composer.address, collateralToken1.address);
    join2 = await NeutralJoin2.new(vat.address, web3.utils.asciiToHex('DPUSDC', 32), composer.address, collateralToken2.address, 6);

    derive1 = await utility.createDeriveContract(
      "ding",
      collateralToken1,
      { address: accounts[0] }, // setting first account as collateral pool
      accounts[0]
    );

    derive2 = await utility.createDeriveContract(
      "ether",
      collateralToken2,
      { address: accounts[0] }, // setting first account as collateral pool
      accounts[0]
    );

    longPositionTokens1 = await PositionToken.at(await derive1.LONG_POSITION_TOKEN());
    shortPositionTokens1 = await PositionToken.at(
      await derive1.SHORT_POSITION_TOKEN()
    );

    longPositionTokens2 = await PositionToken.at(await derive2.LONG_POSITION_TOKEN());
    shortPositionTokens2 = await PositionToken.at(
      await derive2.SHORT_POSITION_TOKEN()
    );

    await derive1.mintPositionTokens(qtyToMint, accounts[1], { from: accounts[0] });
    await derive2.mintPositionTokens(qtyToMint, accounts[1], { from: accounts[0] });

    await composer.file(web3.utils.asciiToHex('whitelisted', 32), derive1.address);
    await composer.file(web3.utils.asciiToHex('neutrals', 32), derive1.address, join1.address);

    await composer.file(web3.utils.asciiToHex('whitelisted', 32), derive2.address);
    await composer.file(web3.utils.asciiToHex('neutrals', 32), derive2.address, join2.address);

    //INSTANTIATE CONTRACT OBJECTS

    longPositionTokensContract1 = new web3.eth.Contract(

      PositionToken.abi,
      longPositionTokens1.address,

      {from: accounts[0]}

    );

    longPositionTokensContract2 = new web3.eth.Contract(

      PositionToken.abi,
      longPositionTokens2.address,

      {from: accounts[0]}

    );

    vatContract = new web3.eth.Contract(

      Vat.abi,
      vat.address,

      {from: accounts[0]}

    );

    shortPositionTokensContract1 = new web3.eth.Contract(

      PositionToken.abi,
      shortPositionTokens1.address,

      {from: accounts[0]}

    );

    shortPositionTokensContract2 = new web3.eth.Contract(

      PositionToken.abi,
      shortPositionTokens2.address,

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

    join2Contract = new web3.eth.Contract(

      NeutralJoin1.abi,
      join2.address,

      {from: accounts[0]}

    );

  })

  it('should have correctly set up the contracts', async function() {
    var whitelisting = await composerContract.methods.whitelisted(derive1.address).call()
    var neutral = await composerContract.methods.neutrals(derive1.address).call()

    var setVat = await join1Contract.methods.vat().call()
    var setIlk= await join1Contract.methods.ilk().call()
    var setCom = await join1Contract.methods.com().call()
    var setDec = await join1Contract.methods.dec().call()
    var setJem = await join1Contract.methods.gem().call()

    var longBalance = await longPositionTokensContract1.methods.balanceOf(accounts[1]).call();
    var shortBalance = await shortPositionTokensContract1.methods.balanceOf(accounts[1]).call();

    assert(longBalance == 12)
    assert(shortBalance == 12)
    assert(whitelisting.toString() == "true");
    assert(neutral.toString() == join1.address);
    assert(setVat.toString() == vat.address);
    assert(setIlk.toString() == "0x4450425553440000000000000000000000000000000000000000000000000000");
    assert(setCom.toString() == composer.address);
    assert(setDec.toString() == 18);
    assert(setJem.toString() == collateralToken1.address)
  })

  it('should join position tokens into a neutral if all conditions are met', async function() {
    await longPositionTokens1.approve(composer.address, "-1", {from: accounts[1]})
    await shortPositionTokens1.approve(composer.address, "-1", {from: accounts[1]})
    await composer.join(accounts[1], derive1.address, 6, {from: accounts[1]})

    var longBalance = await longPositionTokensContract1.methods.balanceOf(accounts[1]).call();
    var shortBalance = await shortPositionTokensContract1.methods.balanceOf(accounts[1]).call();

    assert(longBalance == 6)
    assert(shortBalance == 6)

    longBalance = await longPositionTokensContract1.methods.balanceOf(composer.address).call();
    shortBalance = await shortPositionTokensContract1.methods.balanceOf(composer.address).call();

    assert(longBalance == 6)
    assert(shortBalance == 6)

    var vatGem = await vatContract.methods.gem(web3.utils.asciiToHex('DPBUSD', 32), accounts[1]).call()

    assert(vatGem == 1800)
  })

  it('should exit all positions if all conditions are met', async function() {
    await longPositionTokens1.approve(composer.address, "-1", {from: accounts[1]})
    await shortPositionTokens1.approve(composer.address, "-1", {from: accounts[1]})
    await composer.join(accounts[1], derive1.address, 6, {from: accounts[1]})

    await composer.exit(accounts[1], derive1.address, 1800, {from: accounts[1]})

    var longBalance = await longPositionTokensContract1.methods.balanceOf(composer.address).call();
    var shortBalance = await shortPositionTokensContract1.methods.balanceOf(composer.address).call();

    assert(longBalance == 0)
    assert(shortBalance == 0)

    longBalance = await longPositionTokensContract1.methods.balanceOf(accounts[1]).call();
    shortBalance = await shortPositionTokensContract1.methods.balanceOf(accounts[1]).call();

    assert(longBalance == 12)
    assert(shortBalance == 12)

    var vatGem = await vatContract.methods.gem(web3.utils.asciiToHex('DPBUSD', 32), accounts[1]).call()

    assert(vatGem == 0)
  })

  it('should progressively exit positions if all conditions are met', async function() {
    await longPositionTokens1.approve(composer.address, "-1", {from: accounts[1]})
    await shortPositionTokens1.approve(composer.address, "-1", {from: accounts[1]})
    await composer.join(accounts[1], derive1.address, 6, {from: accounts[1]})

    await composer.exit(accounts[1], derive1.address, "1200", {from: accounts[1]})

    longBalance = await longPositionTokensContract1.methods.balanceOf(composer.address).call();
    shortBalance = await shortPositionTokensContract1.methods.balanceOf(composer.address).call();

    assert(longBalance == 2)
    assert(shortBalance == 2)

    longBalance = await longPositionTokensContract1.methods.balanceOf(accounts[1]).call();
    shortBalance = await shortPositionTokensContract1.methods.balanceOf(accounts[1]).call();

    assert(longBalance == 10)
    assert(shortBalance == 10)

    await composer.exit(accounts[1], derive1.address, "600", {from: accounts[1]})

    longBalance = await longPositionTokensContract1.methods.balanceOf(composer.address).call();
    shortBalance = await shortPositionTokensContract1.methods.balanceOf(composer.address).call();

    assert(longBalance == 0)
    assert(shortBalance == 0)

    longBalance = await longPositionTokensContract1.methods.balanceOf(accounts[1]).call();
    shortBalance = await shortPositionTokensContract1.methods.balanceOf(accounts[1]).call();

    assert(longBalance == 12)
    assert(shortBalance == 12)
  })

  it('should fail if a part exit is not valid', async function() {
    await longPositionTokens1.approve(composer.address, "-1", {from: accounts[1]})
    await shortPositionTokens1.approve(composer.address, "-1", {from: accounts[1]})
    await composer.join(accounts[1], derive1.address, 6, {from: accounts[1]})

    var err;

    try {

      await composer.exit(accounts[1], derive1.address, "1250", {from: accounts[1]})

    } catch(error) {

      err = error;

    }

    assert(err != undefined, "Could exit an invalid amount");

    err = undefined;

    try {

      await composer.exit(accounts[1], derive1.address, "1700", {from: accounts[1]})

    } catch(error) {

      err = error;

    }

    assert(err != undefined, "Could exit an invalid amount");

    err = undefined;

    await composer.exit(accounts[1], derive1.address, "900", {from: accounts[1]})

    try {

      await composer.exit(accounts[1], derive1.address, "400", {from: accounts[1]})

    } catch(error) {

      err = error;

    }

    assert(err != undefined, "Could exit an invalid amount");

  })

  it('should be able to exit after part of the gem was moved', async function() {
    await longPositionTokens1.approve(composer.address, "-1", {from: accounts[1]})
    await shortPositionTokens1.approve(composer.address, "-1", {from: accounts[1]})
    await composer.join(accounts[1], derive1.address, 6, {from: accounts[1]})

    await vat.move(web3.utils.asciiToHex('DPBUSD', 32), accounts[2], 900, {from: accounts[1]})

    await composer.exit(accounts[2], derive1.address, "900", {from: accounts[2]});

    var longBalance = await longPositionTokensContract1.methods.balanceOf(composer.address).call();
    var shortBalance = await shortPositionTokensContract1.methods.balanceOf(composer.address).call();

    assert(longBalance == 3)
    assert(shortBalance == 3)

    longBalance = await longPositionTokensContract1.methods.balanceOf(accounts[2]).call();
    shortBalance = await shortPositionTokensContract1.methods.balanceOf(accounts[2]).call();

    assert(longBalance == 3)
    assert(shortBalance == 3)
  })

  it('should not exit if the caller is not valid', async function() {
    await longPositionTokens1.approve(composer.address, "-1", {from: accounts[1]})
    await shortPositionTokens1.approve(composer.address, "-1", {from: accounts[1]})
    await composer.join(accounts[1], derive1.address, 6, {from: accounts[1]})

    var err;

    try {

      await composer.exit(accounts[1], derive1.address, "900", {from: accounts[2]})

    } catch(error) {

      err = error;

    }

    assert(err != undefined);

    err = undefined;

    await vat.move(web3.utils.asciiToHex('DPBUSD', 32), accounts[2], 900, {from: accounts[1]})

    try {

      await composer.exit(accounts[2], derive1.address, "900", {from: accounts[1]})

    } catch(error) {

      err = error;

    }

    assert(err != undefined);
  })

})
