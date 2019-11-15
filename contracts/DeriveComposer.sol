pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./interfaces/INeutralJoin.sol";
import "./interfaces/IDeriveContract.sol";
import "./libraries/MathLib.sol";
import "./interfaces/VatLike.sol";

contract DeriveComposer is Ownable {

  using SafeMath for uint;

  event Joined(address sender, address custodian, address positions, uint derivative, uint minted);
  event Exited(address sender, address custodian, address positions, uint derivative, uint minted);

  uint256 public live;
  VatLike public vat;

  mapping(address => bool)                     public whitelisted;
  mapping(address => address)                  public neutrals;
  mapping(address => mapping(address => bool)) public custodians;

  constructor(address vat_) public {
    require(vat_ != address(0));
    live = 1;
    vat = VatLike(vat_);
  }

  function join(address custodian, address position, uint wad) external {
    require(live == 1, "Contract is not live");
    require(whitelisted[position] == true, "This position contract is not whitelisted");
    require(neutrals[position] != address(0), "Neutral not set");
    require(INeutralJoin(neutrals[position]).gem() == IDeriveContract(position).COLLATERAL_TOKEN_ADDRESS(), "Join contract has a different gem");
    require(IDeriveContract(position).isSettled() == false, "Contract already settled");
    require(IERC20(IDeriveContract(position).LONG_POSITION_TOKEN()).transferFrom(msg.sender, address(this), wad) == true);
    require(IERC20(IDeriveContract(position).SHORT_POSITION_TOKEN()).transferFrom(msg.sender, address(this), wad) == true);
    require(custodian != address(0), "Custodian cannot be null");

    custodians[msg.sender][custodian] = true;

    uint toMint = MathLib.multiply(wad, IDeriveContract(position).COLLATERAL_PER_UNIT());

    INeutralJoin(neutrals[position]).join(custodian, toMint);

    emit Joined(msg.sender, custodian, position, wad, toMint);
  }

  function exit(address custodian, address position, uint wad) external {
    require(neutrals[position] != address(0), "Neutral not set");
    require(custodian != address(0), "Custodian cannot be null");
    require(custodians[msg.sender][custodian] == true || custodian == msg.sender, "Not your custodian");

    INeutralJoin(neutrals[position]).exit(custodian, wad);

    uint gem = vat.gem(INeutralJoin(neutrals[position]).ilk(), custodian);

    if (gem > 0) {
      require(gem / IDeriveContract(position).COLLATERAL_PER_UNIT() > 0 &&
              gem % IDeriveContract(position).COLLATERAL_PER_UNIT() == 0,
        "Not enough neutral left to exit next time");
    }

    uint toFree = wad / IDeriveContract(position).COLLATERAL_PER_UNIT();

    require(toFree > 0, "Nothing to free");

    require(IERC20(IDeriveContract(position).LONG_POSITION_TOKEN()).transfer(msg.sender, toFree) == true);
    require(IERC20(IDeriveContract(position).SHORT_POSITION_TOKEN()).transfer(msg.sender, toFree) == true);

    emit Exited(msg.sender, custodian, position, toFree, wad);
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
