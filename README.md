# Derive Protocol

Derive Protocol is a modified version of [MARKET Protocol](https://github.com/MARKETProtocol/MARKETProtocol). Namely, we:

- Eliminated the fees for creating position tokens
- Eliminated the MKT token
- Allow users of [diss](https://github.com/komodo-finance/diss) to short their CDPs and thus insure them in case of a market drop
- Allow users to combine long & short positions in a single token (NEUTRAL) which can be used to create [Ding stablecoins](https://github.com/komodo-finance/diss)

In the initial phase, Derive will support positions on Ding, ETH and BUSD.

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
