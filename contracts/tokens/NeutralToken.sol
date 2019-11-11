pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Burnable.sol";

contract NeutralToken is ERC20Mintable, ERC20Burnable {

  string public name;
  string public symbol;
  uint8 public decimals;

  constructor(
      string memory tokenName,
      string memory tokenSymbol,
      uint8 tokenDecimals
  ) public
  {
      name = tokenName;
      symbol = tokenSymbol;
      decimals = tokenDecimals;
  }

}
