pragma solidity ^0.5.11;

import "chainlink/v0.5/contracts/ChainlinkClient.sol";

contract HoneycombPriceFeed is ChainlinkClient {

  uint256 private oraclePaymentAmount;
  bytes32 private jobId;

  mapping(address => bool) public processing;
  mapping(address => uint256) public feeds;
  mapping(bytes32 => address) public targets;

  constructor(
      address _link,
      address _oracle,
      bytes32 _jobId,
      uint256 _oraclePaymentAmount
  ) public {
    wards[msg.sender] = 1;
    setChainlinkToken(_link);
    setChainlinkOracle(_oracle);
    jobId = _jobId;
    oraclePaymentAmount = _oraclePaymentAmount;
  }

  // --- Auth ---
  mapping (address => uint) public wards;
  function rely(address usr) external auth { wards[usr] = 1; }
  function deny(address usr) external auth { wards[usr] = 0; }
  modifier auth {
      require(wards[msg.sender] == 1, "Vat/not-authorized");
      _;
  }

  function makeRequest(address market_, string calldata ticker) external auth returns (bytes32 requestId)
  {
    Chainlink.Request memory req = buildChainlinkRequest(jobId, address(this), this.fulfill.selector);
    req.add("from", ticker);
    req.add("to", "USD");
    req.add("amount", "1");
    req.addInt("times", 1000000000000000000);
    req.add("copypath", "result");
    processing[market_] = true;
    requestId = sendChainlinkRequestTo(chainlinkOracleAddress(), req, oraclePaymentAmount);
    targets[requestId] = market_;
  }

  function resetResult() external {}

  function fulfill(bytes32 _requestId, uint256 _result) public recordChainlinkFulfillment(_requestId)
  {
    address market = targets[_requestId];
    processing[market] = false;
    feeds[market] = _result;
  }

}
