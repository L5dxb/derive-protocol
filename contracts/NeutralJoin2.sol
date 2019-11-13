pragma solidity 0.5.11;

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

    mapping(address => uint256) public lock;
    mapping(address => uint256) public balances;

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

    function mint(address account, uint256 amount) public onlyMinter returns (bool) {
        uint amount18 = mul(amount, 10 ** (18 - dec));
        require(amount18 <= 2 ** 255, "NeutralJoin2/overflow");
        balances[account] = balances[account].add(amount18);
        return true;
    }

    function burn(address account, uint256 amount) public onlyMinter returns (bool) {
        require(balances[account].sub(amount) >= lock[account], "NeutralJoin2/too-many-locked-tokens");
        balances[account] = balances[account].sub(amount);
    }

    function join(address usr, uint wad) public note {
        require(int(wad) >= 0, "NeutralJoin2/overflow");
        require(lock[msg.sender].add(wad) <= balances[msg.sender], "NeutralJoin2/not-enough-free-tokens");
        lock[msg.sender] = lock[msg.sender].add(wad);
        vat.slip(ilk, usr, int(wad));
    }

    function exit(address usr, uint wad) public note {
        require(wad <= 2 ** 255, "NeutralJoin2/overflow");
        lock[msg.sender] = lock[msg.sender].sub(wad);
        vat.slip(ilk, msg.sender, -int(wad));
    }
}
