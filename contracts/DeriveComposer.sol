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
  event Exited(address sender, address positions, uint derivative, uint minted);

  uint256 public live;

  mapping(address => bool)                        public whitelisted;
  mapping(address => address)                     public neutrals;
  mapping(address => mapping(address => uint256)) public contributions;
  mapping(address => mapping(address => uint256)) public minted;

  constructor() public {
    live = 1;
  }

  function join(address position, uint wad) external {
    require(live == 1, "Contract is not live");
    require(whitelisted[position] == true, "This position contract is not whitelisted");
    require(neutrals[position] != address(0), "Neutral not set");
    require(INeutralJoin(neutrals[position]).gem() == IDeriveContract(position).COLLATERAL_TOKEN_ADDRESS(), "Join contract has a different gem");
    require(IDeriveContract(position).isSettled() == false, "Contract already settled");
    require(IERC20(IDeriveContract(position).LONG_POSITION_TOKEN()).transferFrom(msg.sender, address(this), wad) == true);
    require(IERC20(IDeriveContract(position).SHORT_POSITION_TOKEN()).transferFrom(msg.sender, address(this), wad) == true);

    uint toMint = MathLib.multiply(wad, IDeriveContract(position).COLLATERAL_PER_UNIT());

    contributions[msg.sender][neutrals[position]] = contributions[msg.sender][neutrals[position]].add(wad);
    minted[msg.sender][neutrals[position]] = minted[msg.sender][neutrals[position]].add(toMint);

    require(INeutralJoin(neutrals[position]).mint(msg.sender, toMint) == true, "Could not mint");

    emit Joined(msg.sender, position, wad, toMint);
  }

  function exit(address position, uint wad) external {
    require(neutrals[position] != address(0), "Neutral not set");
    require(INeutralJoin(neutrals[position]).burn(msg.sender, wad) == true, "Could not burn");

    uint toFree = wad / IDeriveContract(position).COLLATERAL_PER_UNIT();

    require(toFree > 0, "Nothing to free");

    contributions[msg.sender][neutrals[position]] = contributions[msg.sender][neutrals[position]].sub(toFree);
    minted[msg.sender][neutrals[position]] = minted[msg.sender][neutrals[position]].sub(wad);

    require(IERC20(IDeriveContract(position).LONG_POSITION_TOKEN()).transfer(msg.sender, toFree) == true);
    require(IERC20(IDeriveContract(position).SHORT_POSITION_TOKEN()).transfer(msg.sender, toFree) == true);

    emit Exited(msg.sender, position, toFree, wad);
  }

  //OWNER

  function file(bytes32 what, address who) external onlyOwner {
    if (what == "whitelisted") whitelisted[who] = !whitelisted[who];
    else revert();
  }

  function file(bytes32 what, address who, address wad) external onlyOwner {
    if (what == "neutrals" && neutrals[who] == address(0)) neutrals[who] = wad;
    else revert();
  }

  function cage() external onlyOwner {
    live = 0;
  }

}
