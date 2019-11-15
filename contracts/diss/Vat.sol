pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract Vat {

  using SafeMath for uint;

  mapping(bytes32 => mapping(address => uint)) public gem;

  function slip(bytes32 ilk, address urn, int wad) public {
    if
      (wad < 0) gem[ilk][urn] = gem[ilk][urn].sub(uint(-wad));
    else
      gem[ilk][urn] = gem[ilk][urn].add(uint(wad));
  }

  function move(bytes32 ilk, address who, uint wad) external {
    require(gem[ilk][msg.sender] >= wad);
    gem[ilk][msg.sender] = gem[ilk][msg.sender].sub(wad);
    gem[ilk][who] = gem[ilk][who].add(wad);
  }

}
