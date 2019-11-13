pragma solidity 0.5.11;

contract IPriceFeed {

  function requestUpdate() public payable;
  function completeUpdate() public payable;
  function priceFeed(uint position) public view returns (int128);

}
