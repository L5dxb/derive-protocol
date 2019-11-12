pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./interfaces/INeutralJoin.sol";
import "./interfaces/IDeriveContract.sol";
import "./libraries/MathLib.sol";

contract DeriveComposer is Ownable {

  using SafeMath for uint;

  event Joined(address sender, address positions, uint derivative, uint minted);

  uint256 public live;
  uint256 public lock;

  mapping(address => bool) public whitelisted;
  mapping(address => address) public neutrals;
  mapping(address => mapping(address => uint256)) public contributions;
  mapping(address => mapping(address => uint256)) public minted;
  mapping(address => mapping(address => uint256)) public free;

  constructor(uint256 lock_) public {
    live = 1;
    lock = lock_;
  }

  function join(address positions, uint wad) external {
    require(live == 1, "Contract is not live");
    require(whitelisted[positions] == true, "This positions contract is not whitelisted");
    require(neutrals[positions] != address(0), "Neutral not set");
    require(INeutralJoin(neutrals[positions]).gem() == IDeriveContract(positions).COLLATERAL_TOKEN_ADDRESS(), "Join contract has a different gem");
    require(IDeriveContract(positions).isSettled() == false, "Contract already settled");
    require(IERC20(IDeriveContract(positions).LONG_POSITION_TOKEN()).transferFrom(msg.sender, address(this), wad) == true);
    require(IERC20(IDeriveContract(positions).SHORT_POSITION_TOKEN()).transferFrom(msg.sender, address(this), wad) == true);

    uint toMint = MathLib.multiply(wad, IDeriveContract(positions).COLLATERAL_PER_UNIT());

    free[msg.sender][neutrals[positions]] = now.add(lock);
    contributions[msg.sender][neutrals[positions]] = contributions[msg.sender][neutrals[positions]].add(wad);
    minted[msg.sender][neutrals[positions]] = toMint;

    require(INeutralJoin(neutrals[positions]).mint(msg.sender, toMint) == true, "Could not mint");

    emit Joined(msg.sender, positions, wad, toMint);
  }

  function exit() external {}

  //OWNER

  function file(bytes32 what, address who, bool wad) external onlyOwner {
    if (what == "whitelisted") whitelisted[who] = wad;
    else revert();
  }

  function file(bytes32 what, address who, address wad) external onlyOwner {
    if (what == "neutrals") neutrals[who] = wad;
    else revert();
  }

  function cage() external onlyOwner {
    live = 0;
  }

}
