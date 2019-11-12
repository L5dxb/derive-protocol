pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./interfaces/INeutralJoin.sol";

contract DeriveComposer is Ownable {

  struct Contribution {
    address long;
    address short;

    uint256 longQty;
    uint256 shortQty;
  }

  uint256 public chop;
  uint256 public lock;
  uint256 public nonce;
  INeutralJoin public join;

  mapping(address => bool) public whitelisted;
  mapping(address => mapping(bytes32 => Contribution)) public contributions;
  mapping(bytes32 => mapping(address => uint256)) public minted;
  mapping(bytes32 => mapping(address => bool)) public slashed;
  mapping(address => uint256) public slashes;

  constructor(uint256 chop_, uint256 lock_, address join_) public {
    chop = chop_;
    lock = lock_;
    join = INeutralJoin(join_);
  }

  function single() external {}

  function batch() external {}

  function fill() external {}

  function exit() external {}

  function withdraw() external {}

  //OWNER

  function file(bytes32 what, uint wad) external onlyOwner {

  }

  function file(bytes32 what, address who, uint wad) external onlyOwner {

  }

  function slash() external onlyOwner {

  }

}
