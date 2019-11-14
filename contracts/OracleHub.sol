pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./interfaces/IPriceFeed.sol";
import "./interfaces/IDeriveContractDPX.sol";

contract OracleHub is Ownable {

  event Requested(address feed);
  event Completed(address feed);
  event Updated(address derive, int128 price);

  address public oracle;
  uint256 public fee;

  mapping(address => uint256) public feeds;

  constructor(address oracle_) public {
    oracle = oracle_;
  }

  function file(bytes32 what, address who, uint256 wad) external onlyOwner {
    if (what == "feeds") feeds[who] = wad;
    else revert();
  }

  function file(bytes32 what, uint wad) external onlyOwner {
    if (what == "fee") fee = wad;
    else revert();
  }

  function request() external payable {
    require(fee > 0, "Fee not set");
    require(msg.value == fee, "Did not send the correct fee");
    IPriceFeed(oracle).requestUpdate.value(fee)();
    emit Requested(oracle);
  }

  function complete() external {
    IPriceFeed(oracle).completeUpdate();
    emit Completed(oracle);
  }

  function update(address derive) external onlyOwner {
    int128 price = IPriceFeed(oracle).priceFeed(feeds[derive]);
    require(price > 0, "The price must be positive");
    IDeriveContractDPX(derive).oracleCallBack(uint(price));
    emit Updated(derive, price);
  }

}
