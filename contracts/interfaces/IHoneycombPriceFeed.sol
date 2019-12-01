pragma solidity 0.5.11;

contract IHoneycombPriceFeed {

  function makeRequest(address market_) external returns (bytes32 requestId);
  function processing(address market_) public view returns (bool);
  function feeds(address) public view returns (uint256);

}
