pragma solidity 0.5.11;

contract INeutralJoin {

  function matched(address, bytes32) public view returns (uint256);
  function balances(address) public view returns (uint256);

}
