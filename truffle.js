const Ethers = require('ethers');
var HDWalletProvider = require("truffle-hdwallet-provider-privkey");

const gasPrice = Ethers.utils.parseUnits( process.env.GAS_PRICE || '22', 'gwei');
const gasPriceRinkeby = Ethers.utils.parseUnits( process.env.GAS_PRICE || '17', 'gwei');
const gasPriceKovan = Ethers.utils.parseUnits( process.env.GAS_PRICE || '17', 'gwei');
const gasPriceMainnet = Ethers.utils.parseUnits( process.env.GAS_PRICE || '21', 'gwei');

require('dotenv').config()

var privKey = [process.env.ETHEREUM_PRIV_KEY]
var INFURA_TOKEN = process.env.INFURA_TOKEN

module.exports = {

  plugins: ["truffle-security"],

  networks: {

    development: {
      host: '127.0.0.1',
      port: 8545,
      from: "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1",
      gasPrice: gasPrice,
      gas: 6900000,
      network_id: '*'
    },

    ropsten: {

      provider: function() {
        return new HDWalletProvider(privKey, "https://ropsten.infura.io/v3/" + INFURA_TOKEN)
      },
      network_id: 3,
      gas: 6800000,
      gasPrice: gasPriceRinkeby

    },

    kovan: {

      provider: function() {
        return new HDWalletProvider(privKey, "https://kovan.infura.io/v3/" + INFURA_TOKEN)
      },
      network_id: 42,
      gas: 6800000,
      gasPrice: gasPriceKovan

    },

    rinkeby: {

      provider: function() {
        return new HDWalletProvider(privKey, "https://rinkeby.infura.io/v3/" + INFURA_TOKEN)
      },
      network_id: 4,
      gas: 6800000,
      gasPrice: gasPriceRinkeby

    },

    mainnet: {

      provider: function() {
        return new HDWalletProvider(privKey, "https://mainnet.infura.io/v3/" + INFURA_TOKEN)
      },
      network_id: 1,
      gas: 6500000,
      gasPrice: gasPriceMainnet

    }

  },

  mocha: {
    enableTimeouts: false
  },

  compilers: {
    solc: {
      version: "0.5.11",
    },
  },

  solc: {
    optimizer: { // Turning on compiler optimization that removes some local variables during compilation
      enabled: true,
      runs: 200
    }
  }

}
