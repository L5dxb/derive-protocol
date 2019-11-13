pragma solidity 0.5.11;

contract MockPriceFeed {

  int128[] public priceFeeds;

  constructor() public {
    priceFeeds.push(990000000000000000);
    priceFeeds.push(187320000000000000000);
  }

  function requestUpdate() public payable {
    
  }

  function completeUpdate() public payable {

  }

  function priceFeed(uint position) public view returns (int128) {
    if (position > priceFeeds.length) return 0;
    return priceFeeds[position];
  }

}
