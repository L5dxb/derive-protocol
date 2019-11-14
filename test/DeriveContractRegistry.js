const DeriveContractDPX = artifacts.require('DeriveContractDPX');
const DeriveCollateralPool = artifacts.require('DeriveCollateralPool');
const DeriveContractRegistry = artifacts.require('DeriveContractRegistry');
const CollateralToken = artifacts.require('CollateralToken');
const DeriveContractFactory = artifacts.require('DeriveContractFactoryDPX');

contract('DeriveContractRegistry', function(accounts) {
  let collateralPool;
  let deriveContract;
  let collateralToken;
  let deriveContractRegistry;

  beforeEach(async function() {
    deriveContractRegistry = await DeriveContractRegistry.deployed();
    var whiteList = await deriveContractRegistry.getAddressWhiteList.call();
    deriveContract = await DeriveContractDPX.at(whiteList[1]);
    collateralPool = await DeriveCollateralPool.deployed();
    collateralToken = await CollateralToken.deployed();
  });

  it('Only owner is able to remove contracts to the white list', async function() {
    const ownerAddress = await deriveContractRegistry.owner.call();
    assert.equal(accounts[0], ownerAddress, "owner isn't our first account");

    var isAddressWhiteListed = await deriveContractRegistry.isAddressWhiteListed.call(
      deriveContract.address
    );
    assert.isTrue(isAddressWhiteListed, 'Deployed Derive Contract is not White Listed');

    var addressWhiteList = await deriveContractRegistry.getAddressWhiteList.call();
    var addressIndex = -1;
    for (i = 0; i < addressWhiteList.length; i++) {
      var deployedAddress = addressWhiteList[i];
      if (deployedAddress == deriveContract.address) {
        addressIndex = i;
        break;
      }
    }
    assert.isTrue(addressIndex != -1, 'Address not found in white list');

    let error = null;
    try {
      await deriveContractRegistry.removeContractFromWhiteList(
        deriveContract.address,
        addressIndex,
        { from: accounts[1] }
      );
    } catch (err) {
      error = err;
    }
    assert.ok(error instanceof Error, "Removing contract from whitelist by non owner didn't fail!");

    isAddressWhiteListed = await deriveContractRegistry.isAddressWhiteListed.call(
      deriveContract.address
    );
    assert.isTrue(
      isAddressWhiteListed,
      'Derive Contract was removed from white list by non owner!'
    );

    await deriveContractRegistry.removeContractFromWhiteList(deriveContract.address, addressIndex, {
      from: accounts[0]
    });

    isAddressWhiteListed = await deriveContractRegistry.isAddressWhiteListed.call(
      deriveContract.address
    );
    assert.isTrue(
      !isAddressWhiteListed,
      'Derive Contract was not removed from white list by owner'
    );

    error = null;
    try {
      await deriveContractRegistry.addAddressToWhiteList(deriveContract.address, {
        from: accounts[1]
      });
    } catch (err) {
      error = err;
    }
    assert.ok(error instanceof Error, "Adding contract to whitelist by non owner didn't fail!");

    await deriveContractRegistry.addAddressToWhiteList(deriveContract.address, {
      from: accounts[0]
    });
    isAddressWhiteListed = await deriveContractRegistry.isAddressWhiteListed.call(
      deriveContract.address
    );
    assert.isTrue(
      isAddressWhiteListed,
      'Derive Contract was not added back to white list by owner'
    );
  });

  it('Non white listed contract cannot be removed', async function() {
    const ownerAddress = await deriveContractRegistry.owner.call();
    assert.equal(accounts[0], ownerAddress, "owner isn't our first account");

    var isAddressWhiteListed = await deriveContractRegistry.isAddressWhiteListed.call(
      deriveContract.address
    );
    assert.isTrue(isAddressWhiteListed, 'Deployed Derive Contract is not White Listed');

    var addressWhiteList = await deriveContractRegistry.getAddressWhiteList.call();
    var addressIndex = -1;
    for (i = 0; i < addressWhiteList.length; i++) {
      var deployedAddress = addressWhiteList[i];
      if (deployedAddress == deriveContract.address) {
        addressIndex = i;
        break;
      }
    }
    assert.isTrue(addressIndex != -1, 'Address not found in white list');

    await deriveContractRegistry.removeContractFromWhiteList(deriveContract.address, addressIndex, {
      from: accounts[0]
    });

    isAddressWhiteListed = await deriveContractRegistry.isAddressWhiteListed.call(
      deriveContract.address
    );
    assert.isTrue(
      !isAddressWhiteListed,
      'Derive Contract was not removed from white list by owner'
    );

    error = null;
    try {
      await deriveContractRegistry.removeContractFromWhiteList(
        deriveContract.address,
        addressIndex,
        { from: accounts[0] }
      );
    } catch (err) {
      error = err;
    }
    assert.ok(
      error instanceof Error,
      "removing non white listed contract to whitelist by non owner didn't fail!"
    );

    await deriveContractRegistry.addAddressToWhiteList(deriveContract.address, {
      from: accounts[0]
    });
    isAddressWhiteListed = await deriveContractRegistry.isAddressWhiteListed.call(
      deriveContract.address
    );
    assert.isTrue(
      isAddressWhiteListed,
      'Derive Contract was not added back to white list by owner'
    );
  });

  it('White listed contract cannot be removed with bad index', async function() {
    const ownerAddress = await deriveContractRegistry.owner.call();
    assert.equal(accounts[0], ownerAddress, "owner isn't our first account");

    var isAddressWhiteListed = await deriveContractRegistry.isAddressWhiteListed.call(
      deriveContract.address
    );
    assert.isTrue(isAddressWhiteListed, 'Deployed Derive Contract is not White Listed');

    // we need to deploy a second derive contract and add it to the white list in order
    // for us to test the case where there are multiple addresses in the white list and we
    // attempt to remove one with an incorrect index.
    var addressWhiteList = await deriveContractRegistry.getAddressWhiteList.call();
    var addressIndex = -1;
    for (i = 0; i < addressWhiteList.length; i++) {
      var deployedAddress = addressWhiteList[i];
      if (deployedAddress == deriveContract.address) {
        addressIndex = i;
        break;
      }
    }
    assert.isTrue(addressIndex != -1, 'Address not found in white list');
    // find a valid index, but not the correct one for this contract and attempt to remove it!
    var wrongIndex = addressIndex == addressWhiteList.length - 1 ? 0 : addressWhiteList.length - 1;
    error = null;
    try {
      await deriveContractRegistry.removeContractFromWhiteList(
        deriveContract.address,
        wrongIndex, //random index
        { from: accounts[0] }
      );
    } catch (err) {
      error = err;
    }
    assert.ok(
      error instanceof Error,
      "removing non white listed contract to whitelist by non owner didn't fail!"
    );
  });

  it('Cannot re-add white listed contract', async function() {
    const ownerAddress = await deriveContractRegistry.owner.call();
    assert.equal(accounts[0], ownerAddress, "owner isn't our first account");

    var isAddressWhiteListed = await deriveContractRegistry.isAddressWhiteListed.call(
      deriveContract.address
    );
    assert.isTrue(isAddressWhiteListed, 'Deployed Derive Contract is not White Listed');

    // attempt to add the contract to the whitelist a second time should fail!
    let error = null;
    try {
      await deriveContractRegistry.addAddressToWhiteList(deriveContract.address, {
        from: ownerAddress
      });
    } catch (err) {
      error = err;
    }
    assert.ok(
      error instanceof Error,
      "Adding contract to whitelist when its already there didn't fail"
    );
  });

  it('Only owner is able to remove factory address', async function() {
    const ownerAddress = await deriveContractRegistry.owner.call();
    assert.equal(accounts[0], ownerAddress, "owner isn't our first account");

    const factoryAddress = DeriveContractFactory.address;
    const fakeFactoryAddress = accounts[3];

    let error = null;
    try {
      await deriveContractRegistry.removeFactoryAddress(fakeFactoryAddress, { from: accounts[0] });
    } catch (err) {
      error = err;
    }
    assert.ok(error instanceof Error, 'removing non factory address should fail!');

    await deriveContractRegistry.removeFactoryAddress(factoryAddress, { from: accounts[0] });

    assert.isTrue(
      !(await deriveContractRegistry.factoryAddressWhiteList(factoryAddress)),
      'Removed factory address not removed from mapping'
    );

    await deriveContractRegistry.addFactoryAddress(factoryAddress, { from: accounts[0] });

    assert.isTrue(
      await deriveContractRegistry.factoryAddressWhiteList(factoryAddress),
      'Factory address added back'
    );
  });
});
