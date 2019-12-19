# Derive Protocol

Derive Protocol is a modified version of [MARKET Protocol](https://github.com/MARKETProtocol/MARKETProtocol). We allow users to combine long & short positions in a single token (NEUTRAL) with the value backed by the tokens in the margin accounts of the matched positions. A NEUTRAL can be used to create [Ding stablecoins](https://github.com/ding-dao/diss)

The [Honeycomb Market's](https://honeycomb.market/) oracle services are used to provide underlying ticker data.

## Dependencies
This project uses Node.js version 8.10.0 - 8.11.3.

If you are running multiple versions of Node.js, consider using [Node Version Manager](https://github.com/creationix/nvm) (nvm). nvm is an easy way to configure and manage different Node.js versions to work with your projects.

## Getting Started

Clone this repository and use npm to install needed dependencies

```
$ git clone https://github.com/komodo-finance/DeriveProtocol.git
$ cd DeriveProtocol
$ npm install
```

## Tests

Start a local ganache chain in a terminal with
```
$ ganache-cli -l 7000000 -e 10000000 -d
```

Run the example migrations as well as the accompanying tests inside the truffle console

```
npm run migrateDev
npm run test
```
