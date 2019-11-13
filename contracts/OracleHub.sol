pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./interfaces/IPriceFeed.sol";
import "./interfaces/IDeriveContractDPX.sol";

contract OracleHub is Ownable {

  event Requested(address feed);
  event Completed(address feed);
  event Updated(int128 price);

  mapping(address => address) public feeds;
  mapping(address => uint256) public fees;

  constructor() public {}

  function file(bytes32 what, address who, address wad) external onlyOwner {
    if (what == "feeds") feeds[who] = wad;
    else revert();
  }

  function file(bytes32 what, address who, uint256 wad) external onlyOwner {
    if (what == "fees") fees[who] = wad;
    else revert();
  }

  function request(address feed) external payable {
    require(fees[feed] > 0, "Fees must be set");
    require(msg.value == fees[feed], "Did not send the correct fee amount");
    IPriceFeed(feed).requestUpdate.value(msg.value)();
    emit Requested(feed);
  }

  function complete(address feed) external {
    require(fees[feed] > 0, "Fees must be set");
    IPriceFeed(feed).completeUpdate();
    emit Completed(feed);
  }

  function update(address derive) external onlyOwner {
    require(feeds[derive] != address(0), "The feed for this contract must be set");
    int128 price = IPriceFeed(feeds[derive]).price();
    require(price > 0, "The price must be positive");
    IDeriveContractDPX(derive).oracleCallBack(uint(price));
    emit Updated(price);
  }

}
