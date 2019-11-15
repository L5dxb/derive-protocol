pragma solidity 0.5.11;

contract ComposeMatcher {

  enum Positions {LONG, SHORT}

  struct Spark {
    bool custodianAccepted;
    address custodian;
    address derive;
    address initializer;
    Positions initialPosition;
    uint256 initialCapital;
    uint256 openDeadline;
  }

  uint256 public nonce;

  mapping(uint256 => address) public initializers;
  mapping(uint256 => Spark) public sparks;
  mapping(uint256 => address[]) public fillers;
  mapping(uint256 => uint256[]) public fills;

  constructor() public {}



}
