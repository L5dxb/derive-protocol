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

import "./DeriveContractDPX.sol";
import "../DeriveContractRegistryInterface.sol";

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


/// @title DeriveContractFactoryDPX
/// @author Phil Elsasser <phil@marketprotocol.io>
contract DeriveContractFactoryDPX is Ownable {

    address public deriveContractRegistry;
    address public oracleHub;
    address public DERIVE_COLLATERAL_POOL;

    event DeriveContractCreated(address indexed creator, address indexed contractAddress);

    /// @dev deploys our factory and ties it to the supplied registry address
    /// @param registryAddress - address of our MARKET registry
    /// @param collateralPoolAddress - address of our MARKET Collateral pool
    /// @param oracleHubAddress - address of the MPX oracle
    constructor(
        address registryAddress,
        address collateralPoolAddress,
        address oracleHubAddress
    ) public {
        require(registryAddress != address(0), "registryAddress can not be null");
        require(collateralPoolAddress != address(0), "collateralPoolAddress can not be null");
        require(oracleHubAddress != address(0), "oracleHubAddress can not be null");

        deriveContractRegistry = registryAddress;
        DERIVE_COLLATERAL_POOL = collateralPoolAddress;
        oracleHub = oracleHubAddress;
    }

    /// @dev Deploys a new instance of a market contract and adds it to the whitelist.
    /// @param contractNames bytes32 array of names
    ///     contractName            name of the market contract
    ///     longTokenSymbol         symbol for the long token
    ///     shortTokenSymbol        symbol for the short token
    /// @param collateralTokenAddress address of the ERC20 token that will be used for collateral and pricing
    /// @param contractSpecs array of unsigned integers including:
    ///     floorPrice              minimum tradeable price of this contract, contract enters settlement if breached
    ///     capPrice                maximum tradeable price of this contract, contract enters settlement if breached
    ///     priceDecimalPlaces      number of decimal places to convert our queried price from a floating point to
    ///                             an integer
    ///     qtyMultiplier           multiply traded qty by this value from base units of collateral token.
    ///     expirationTimeStamp     seconds from epoch that this contract expires and enters settlement
    /// @param oracleURL url of data
    /// @param oracleStatistic statistic type (lastPrice, vwap, etc)
    function deployDeriveContractDPX(
        bytes32[3] calldata contractNames,
        address collateralTokenAddress,
        uint[5] calldata contractSpecs,
        string calldata oracleURL,
        string calldata oracleStatistic
    ) external onlyOwner
    {
        DeriveContractDPX drvContract = new DeriveContractDPX(
            contractNames,
            [
            owner(),
            collateralTokenAddress,
            DERIVE_COLLATERAL_POOL
            ],
            oracleHub,
            contractSpecs,
            oracleURL,
            oracleStatistic
        );

        DeriveContractRegistryInterface(deriveContractRegistry).addAddressToWhiteList(address(drvContract));
        emit DeriveContractCreated(msg.sender, address(drvContract));
    }

    /// @dev allows for the owner to set the desired registry for contract creation.
    /// @param registryAddress desired registry address.
    function setRegistryAddress(address registryAddress) external onlyOwner {
        require(registryAddress != address(0), "registryAddress can not be null");
        deriveContractRegistry = registryAddress;
    }

    /// @dev allows for the owner to set a new oracle hub address which is responsible for providing data to our
    /// contracts
    /// @param oracleHubAddress   address of the oracle hub, cannot be null address
    function setOracleHubAddress(address oracleHubAddress) external onlyOwner {
        require(oracleHubAddress != address(0), "oracleHubAddress can not be null");
        oracleHub = oracleHubAddress;
    }
}
