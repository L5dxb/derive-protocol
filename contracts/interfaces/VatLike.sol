pragma solidity ^0.5.11;

contract VatLike {

  function slip(bytes32,address,int) public;
  function gem(bytes32 ilk, address urn) public view returns (uint);

}
