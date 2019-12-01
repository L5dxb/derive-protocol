pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../interfaces/IHoneycombPriceFeed.sol";
import "../interfaces/IDeriveContractDPX.sol";

contract HoneycombOracle is Ownable {

  event Requested(address derive, string ticker);
  event Updated(address derive, int128 price);
  event Filed(address market, string data);

  IHoneycombPriceFeed public priceFeed;

  mapping(address => string) public ticker;

  constructor(address _feed) public {
    priceFeed = IHoneycombPriceFeed(_feed);
  }

  function file(address market, string calldata data) external onlyOwner {
    ticker[market] = data;
    emit Filed(market, data);
  }

  function request(address derive) external onlyOwner {
    require(priceFeed.processing(derive) == false, "Another ongoing request");
    priceFeed.makeRequest(derive, ticker[derive]);
    emit Requested(derive, ticker[derive]);
  }

  function update(address derive) external onlyOwner {
    require(priceFeed.processing(derive) == false, "Another ongoing request");
    uint price = priceFeed.feeds(derive);
    require(price > 0, "The price must be positive");
    IDeriveContractDPX(derive).oracleCallBack(uint(price));
    emit Updated(derive, price);
  }

}
