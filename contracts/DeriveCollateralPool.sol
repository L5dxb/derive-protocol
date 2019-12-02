/*
    Copyright 2017-2019 Phillip A. Elsasser

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

pragma solidity ^0.5.11;

import "./libraries/MathLib.sol";
import "./DeriveContract.sol";
import "./tokens/PositionToken.sol";
import "./DeriveContractRegistryInterface.sol";

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


/// @title DeriveCollateralPool
/// @notice This collateral pool houses all of the collateral for all derive contracts currently in circulation.
/// This pool facilitates locking of collateral and minting / redemption of position tokens for that collateral.
/// @author Phil Elsasser <phil@marketprotocol.io>
contract DeriveCollateralPool is Ownable {
    using MathLib for uint;
    using MathLib for int;

    address public deriveContractRegistry;

    mapping(address => uint) public contractAddressToCollateralPoolBalance; // current balance of all collateral committed

    event TokensMinted(
        address indexed deriveContract,
        address indexed user,
        uint qtyMinted,
        uint collateralLocked
    );

    event TokensRedeemed (
        address indexed deriveContract,
        address indexed user,
        uint longQtyRedeemed,
        uint shortQtyRedeemed,
        uint collateralUnlocked
    );

    constructor(address deriveContractRegistryAddress) public {
        deriveContractRegistry = deriveContractRegistryAddress;
    }

    /*
    // EXTERNAL METHODS
    */

    /// @notice Called by a user that would like to mint a new set of long and short token for a specified
    /// derive contract.  This will transfer and lock the correct amount of collateral into the pool
    /// and issue them the requested qty of long and short tokens
    /// @param deriveContractAddress            address of the derive contract to redeem tokens for
    /// @param qtyToMint                      quantity of long / short tokens to mint.
    function mintPositionTokens(
        address deriveContractAddress,
        uint qtyToMint
    ) external onlyWhiteListedAddress(deriveContractAddress)
    {

        DeriveContract deriveContract = DeriveContract(deriveContractAddress);
        require(!deriveContract.isSettled(), "Contract is already settled");

        address collateralTokenAddress = deriveContract.COLLATERAL_TOKEN_ADDRESS();
        uint neededCollateral = MathLib.multiply(qtyToMint, deriveContract.COLLATERAL_PER_UNIT());

        uint totalCollateralTokenTransferAmount;

        // EXTERNAL CALL - transferring ERC20 tokens from sender to this contract.  User must have called
        // ERC20.approve in order for this call to succeed.
        ERC20(deriveContract.COLLATERAL_TOKEN_ADDRESS()).transferFrom(msg.sender, address(this), neededCollateral);

        // Update the collateral pool locked balance.
        contractAddressToCollateralPoolBalance[deriveContractAddress] = contractAddressToCollateralPoolBalance[
            deriveContractAddress
        ].add(neededCollateral);

        // mint and distribute short and long position tokens to our caller
        deriveContract.mintPositionTokens(qtyToMint, msg.sender);

        emit TokensMinted(
            deriveContractAddress,
            msg.sender,
            qtyToMint,
            neededCollateral
        );
    }

    /// @notice Called by a user that currently holds both short and long position tokens and would like to redeem them
    /// for their collateral.
    /// @param deriveContractAddress            address of the derive contract to redeem tokens for
    /// @param qtyToRedeem                      quantity of long / short tokens to redeem.
    function redeemPositionTokens(
        address deriveContractAddress,
        uint qtyToRedeem
    ) external onlyWhiteListedAddress(deriveContractAddress)
    {
        DeriveContract deriveContract = DeriveContract(deriveContractAddress);

        deriveContract.redeemLongToken(qtyToRedeem, msg.sender);
        deriveContract.redeemShortToken(qtyToRedeem, msg.sender);

        // calculate collateral to return and update pool balance
        uint collateralToReturn = MathLib.multiply(qtyToRedeem, deriveContract.COLLATERAL_PER_UNIT());
        contractAddressToCollateralPoolBalance[deriveContractAddress] = contractAddressToCollateralPoolBalance[
            deriveContractAddress
        ].subtract(collateralToReturn);

        // EXTERNAL CALL
        // transfer collateral back to user
        ERC20(deriveContract.COLLATERAL_TOKEN_ADDRESS()).transfer(msg.sender, collateralToReturn);

        emit TokensRedeemed(
            deriveContractAddress,
            msg.sender,
            qtyToRedeem,
            qtyToRedeem,
            collateralToReturn
        );
    }

    // @notice called by a user after settlement has occurred.  This function will finalize all accounting around any
    // outstanding positions and return all remaining collateral to the caller. This should only be called after
    // settlement has occurred.
    /// @param deriveContractAddress address of the DERIVE Contract being traded.
    /// @param longQtyToRedeem qty to redeem of long tokens
    /// @param shortQtyToRedeem qty to redeem of short tokens
    function settleAndClose(
        address deriveContractAddress,
        uint longQtyToRedeem,
        uint shortQtyToRedeem
    ) external onlyWhiteListedAddress(deriveContractAddress)
    {
        DeriveContract deriveContract = DeriveContract(deriveContractAddress);
        require(deriveContract.isPostSettlementDelay(), "Contract is not past settlement delay");

        // burn tokens being redeemed.
        if (longQtyToRedeem > 0) {
            deriveContract.redeemLongToken(longQtyToRedeem, msg.sender);
        }

        if (shortQtyToRedeem > 0) {
            deriveContract.redeemShortToken(shortQtyToRedeem, msg.sender);
        }


        // calculate amount of collateral to return and update pool balances
        uint collateralToReturn = MathLib.calculateCollateralToReturn(
            deriveContract.PRICE_FLOOR(),
            deriveContract.PRICE_CAP(),
            deriveContract.QTY_MULTIPLIER(),
            longQtyToRedeem,
            shortQtyToRedeem,
            deriveContract.settlementPrice()
        );

        contractAddressToCollateralPoolBalance[deriveContractAddress] = contractAddressToCollateralPoolBalance[
            deriveContractAddress
        ].subtract(collateralToReturn);

        // return collateral tokens
        ERC20(deriveContract.COLLATERAL_TOKEN_ADDRESS()).transfer(msg.sender, collateralToReturn);

        emit TokensRedeemed(
            deriveContractAddress,
            msg.sender,
            longQtyToRedeem,
            shortQtyToRedeem,
            collateralToReturn
        );
    }

    /// @dev allows the owner to update the mkt token address in use for fees
    /// @param deriveContractRegistryAddress address of new contract registry
    function setDeriveContractRegistryAddress(address deriveContractRegistryAddress) public onlyOwner {
        require(deriveContractRegistryAddress != address(0), "Cannot set Derive Contract Registry Address To Null");
        deriveContractRegistry = deriveContractRegistryAddress;
    }

    /*
    // MODIFIERS
    */

    /// @notice only can be called with a derive contract address that currently exists in our whitelist
    /// this ensure's it is a derive contract that has been created by us and therefore has a uniquely created
    /// long and short token address.  If it didn't we could have spoofed contracts minting tokens with a
    /// collateral token that wasn't the same as the intended token.
    modifier onlyWhiteListedAddress(address deriveContractAddress) {
        require(
            DeriveContractRegistryInterface(deriveContractRegistry).isAddressWhiteListed(deriveContractAddress),
            "Contract is not whitelisted"
        );
        _;
    }
}
