pragma solidity 0.5.11;

import {MinterRole} from "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./interfaces/VatLike.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./interfaces/IDeriveComposer.sol";

contract NeutralJoin is MinterRole, Ownable {
    using SafeMath for uint;

    VatLike         public vat;
    bytes32         public ilk;
    IDeriveComposer public com;
    uint            public dec;

    mapping(address => uint256) public lock;
    mapping(address => uint256) public balances;
    mapping(address => mapping(bytes32 => uint256)) public matched;

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

    constructor(address vat_, bytes32 ilk_, address com_) public {
        vat = VatLike(vat_);
        ilk = ilk_;
        com = IDeriveComposer(com_);
        dec = 18;
        _addMinter(com_);
    }

    function mint(bytes32 match_, address account, uint256 amount) public onlyMinter returns (bool) {
        require(com.slashes(account) == 0, "NeutralJoin/unresolved-slashes");
        balances[account] = balances[account].add(amount);
        matched[account][match_] = matched[account][match_].add(amount);
        return true;
    }

    function burn(bytes32 match_, uint256 amount) public {
        require(balances[msg.sender].sub(amount) >= lock[msg.sender], "NeutralJoin/too-many-locked-tokens");
        balances[msg.sender] = balances[msg.sender].sub(amount);
        matched[msg.sender][match_] = matched[msg.sender][match_].sub(amount);
    }

    function join(address usr, uint wad) public note {
        require(com.slashes(msg.sender) == 0, "NeutralJoin/unresolved-slashes");
        require(int(wad) >= 0, "NeutralJoin/overflow");
        require(lock[msg.sender].add(wad) <= balances[msg.sender], "NeutralJoin/not-enough-free-tokens");
        lock[msg.sender] = lock[msg.sender].add(wad);
        vat.slip(ilk, usr, int(wad));
    }

    function exit(address usr, uint wad) public note {
        require(wad <= 2 ** 255, "NeutralJoin/overflow");
        lock[msg.sender] = lock[msg.sender].sub(wad);
        vat.slip(ilk, msg.sender, -int(wad));
    }
}
