pragma solidity ^0.5.11;

contract MockDeriveContract {

  event UpdatedLastPrice(uint256 price);

  address public oracleHub;
  uint256 public lastPrice;

  modifier onlyOracleHub() {
    require(msg.sender == oracleHub);
    _;
  }

  constructor(address oracleHub_) public {
    oracleHub = oracleHub_;
  }

  function oracleCallBack(uint256 price) public onlyOracleHub {
      lastPrice = price;
      emit UpdatedLastPrice(price);
  }

}
