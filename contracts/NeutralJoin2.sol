pragma solidity ^0.5.11;

import {MinterRole} from "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./interfaces/VatLike.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract NeutralJoin2 is MinterRole, Ownable {
    using SafeMath for uint;

    VatLike         public vat;
    bytes32         public ilk;
    address         public com;
    uint            public dec;
    address         public gem;

    modifier note {
        _;
        assembly {
            // log an 'anonymous' event with a constant 6 words of calldata
            // and four indexed topics: the selector and the first three args
            let mark := msize                         // end of memory ensures zero
            mstore(0x40, add(mark, 288))              // update free memory pointer
            mstore(mark, 0x20)                        // bytes type data offset
            mstore(add(mark, 0x20), 224)              // bytes size (padded)
            calldatacopy(add(mark, 0x40), 0, 224)     // bytes payload
            log4(mark, 288,                           // calldata
                 shl(224, shr(224, calldataload(0))), // msg.sig
                 calldataload(4),                     // arg1
                 calldataload(36),                    // arg2
                 calldataload(68)                     // arg3
                )
        }
    }

    constructor(address vat_, bytes32 ilk_, address com_, address gem_, uint decimals) public {
        vat = VatLike(vat_);
        ilk = ilk_;
        com = com_;
        gem = gem_;
        dec = decimals;
        _addMinter(com_);
    }

    function mul(uint x, uint y) internal pure returns (uint z) {
        require(y == 0 || (z = x * y) / y == x, "NeutralJoin2/overflow");
    }

    function join(address usr, uint wad) public note onlyMinter {
        uint amount18 = mul(wad, 10 ** (18 - dec));
        require(amount18 >= 0, "NeutralJoin2/overflow");
        vat.slip(ilk, usr, int(amount18));
    }

    function exit(address usr, uint wad) public note onlyMinter {
        uint amount18 = mul(wad, 10 ** (18 - dec));
        require(amount18 <= 2 ** 255, "NeutralJoin2/overflow");
        vat.slip(ilk, usr, -int(amount18));
    }
}
