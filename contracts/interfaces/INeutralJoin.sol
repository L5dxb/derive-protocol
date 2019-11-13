pragma solidity 0.5.11;

contract INeutralJoin {

  function matched(address, bytes32) public view returns (uint256);
  function balances(address) public view returns (uint256);
  function gem() public view returns (address);
  function mint(address account, uint256 amount) public returns (bool);
  function burn(address account, uint256 amount) public returns (bool);

}
