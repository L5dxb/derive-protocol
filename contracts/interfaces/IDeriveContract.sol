pragma solidity ^0.5.11;

contract IDeriveContract {

  function LONG_POSITION_TOKEN() public view returns (address);
  function SHORT_POSITION_TOKEN() public view returns (address);
  function isSettled() public view returns (bool);
  function COLLATERAL_PER_UNIT() public view returns (uint256);
  function COLLATERAL_TOKEN_ADDRESS() public view returns (address);

}
