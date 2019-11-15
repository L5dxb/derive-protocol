pragma solidity 0.5.11;

contract INeutralJoin {

  function gem() public view returns (address);
  function ilk() public view returns (bytes32);
  function join(address usr, uint wad) public;
  function exit(address usr, uint wad) public;

}
