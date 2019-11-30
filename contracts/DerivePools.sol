pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "./interfaces/INeutralJoin.sol";
import "./interfaces/IDeriveContract.sol";
import "./libraries/MathLib.sol";
import "./interfaces/VatLike.sol";

contract DerivePools {

  using SafeMath for uint;

  event Joined(
    bytes buySig,
    bytes sellSig,
    address buyer,
    address seller,
    uint amount,
    bytes32 neutral
  );
  event Swapped(
    bytes32 neutral,

    bytes exitSig,
    address exiter,

    bytes joinSig,
    address joiner,

    uint amount,
    bool side
  );
  event Filed(bytes32 neutral, bytes32 what, address data);
  event Filed(bytes32 neutral, uint data);
  event Filed(uint wait);

  // --- Auth ---
  mapping (address => uint) public wards;
  function rely(address usr) external note auth { wards[usr] = 1; }
  function deny(address usr) external note auth { wards[usr] = 0; }
  modifier auth {
      require(wards[msg.sender] == 1, "Vat/not-authorized");
      _;
  }

  struct Neutral {
    address market;
    address custodian;
    address join;
    uint    matched;
    uint    line;
  }

  uint public wait;

  mapping(bytes32 => Neutral)                                      neutrals;
  mapping(address => mapping(bytes32 => mapping(address => uint))) public balances;
  mapping(address => uint256)                                      public nonce;
  mapping(address => mapping(bytes32 => uint))                     public cooldown;

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

  constructor() public {
    wards[msg.sender] = 1;
  }

  function file(bytes32 neutral, bytes32 what, address data) external auth {
    require(neutrals[neutral].matched == 0, "Pools/matches-already-present");

    if (what == "market") {
      neutrals[neutral].market = data;
    } else if (what == "custodian") {
      neutrals[neutral].custodian = data;
    } else if (what == "join") {
      neutrals[neutral].join = data;
    } else revert();

    emit Filed(neutral, what, data);
  }

  function file(bytes32 neutral, uint data) external auth {
    neutrals[neutral].line = data;
    emit Filed(neutral, data);
  }

  function file(uint data) external auth {
    wait = data;
    emit Filed(wait);
  }

  function flip(
    bytes calldata buySig,
    bytes calldata sellSig,
    address        buyer,
    address        seller,
    uint           amount,
    bytes32        neutral,
    bool           way
  ) external auth {
    require(amount > 0, "Pools/invalid-amount");
    require(neutrals[neutral].market != address(0), "Pools/market-not-set");
    require(cooldown[buyer][neutral] == 0 || now <= cooldown[buyer][neutral], "Pools/buyer-must-wait");
    require(cooldown[seller][neutral] == 0 || now <= cooldown[seller][neutral], "Pools/seller-must-wait");

    uint currentBuy = IERC20(IDeriveContract(neutrals[neutral].market).LONG_POSITION_TOKEN()).balanceOf(address(this));
    uint currentSell = IERC20(IDeriveContract(neutrals[neutral].market).SHORT_POSITION_TOKEN()).balanceOf(address(this));

    pool(
      way,
      buySig,
      sellSig,
      buyer,
      seller,
      IDeriveContract(neutrals[neutral].market).LONG_POSITION_TOKEN(),
      IDeriveContract(neutrals[neutral].market).SHORT_POSITION_TOKEN(),
      IERC20(IDeriveContract(neutrals[neutral].market).LONG_POSITION_TOKEN()).balanceOf(address(this)),
      IERC20(IDeriveContract(neutrals[neutral].market).SHORT_POSITION_TOKEN()).balanceOf(address(this)),
      amount
    );

    if (way) {
      require(IERC20(IDeriveContract(neutrals[neutral].market).LONG_POSITION_TOKEN()).balanceOf(address(this)) == currentBuy.add(amount), "Pools/incorrect-internal-balance");
    } else {
      require(IERC20(IDeriveContract(neutrals[neutral].market).SHORT_POSITION_TOKEN()).balanceOf(address(this)) == currentBuy.sub(amount), "Pools/incorrect-internal-balance");
    }

    flow(
      neutral,
      way,
      amount,
      buyer,
      seller,
      IDeriveContract(neutrals[neutral].market).LONG_POSITION_TOKEN(),
      IDeriveContract(neutrals[neutral].market).SHORT_POSITION_TOKEN()
    );

    emit Joined(
      buySig,
      sellSig,
      buyer,
      seller,
      amount,
      neutral
    );
  }

  function flow(
    bytes32 neutral,
    bool way,
    uint amount,
    address buyer,
    address seller,
    address buy,
    address sell
  ) internal {
    uint funds = MathLib.multiply(amount, IDeriveContract(neutrals[neutral].market).COLLATERAL_PER_UNIT());

    if (way) {
      balances[buyer][neutral][buy] = balances[buyer][neutral][buy].add(amount);
      balances[seller][neutral][sell] = balances[seller][neutral][sell].add(amount);

      neutrals[neutral].matched = neutrals[neutral].matched.add(funds);
      require(neutrals[neutral].matched <= neutrals[neutral].line, "Pools/above-line");
      INeutralJoin(neutrals[neutral].join).join(neutrals[neutral].custodian, funds);
    } else {
      balances[buyer][neutral][buy] = balances[buyer][neutral][buy].sub(amount);
      balances[seller][neutral][sell] = balances[seller][neutral][sell].sub(amount);

      neutrals[neutral].matched = neutrals[neutral].matched.sub(funds);
      INeutralJoin(neutrals[neutral].join).join(neutrals[neutral].custodian, funds);
    }

    cooldown[buyer][neutral] = cooldown[buyer][neutral].add(wait);
    cooldown[seller][neutral] = cooldown[seller][neutral].add(wait);
  }

  function pool(
    bool way,
    bytes memory buySig,
    bytes memory sellSig,
    address buyer,
    address seller,
    address buy,
    address sell,
    uint currentBuy,
    uint currentSell,
    uint amount
  ) internal {
    require(sell != address(0) && buy != address(0), "Pool/duo-not-set");

    bytes memory data;
    bytes32 _hash;

    if (way)
      data = getData(bytes32("transfer"), address(0), amount);
    else {
      data = getData(bytes32("transferFrom"), buyer, amount);
    }

    _hash = getHash(buyer, buy, 0, data);
    require(getSigner(_hash, buySig) == buyer, "Pools/invalid-signer");

    if (way) {
      // IERC20(buy).approve(buyer, 0);
      // IERC20(buy).approve(buyer, amount);
      transferFrom(buy, buyer, amount);
    } else {
      transfer(buy, buyer, amount);
    }

    if (way)
      data = getData(bytes32("transfer"), address(0), amount);
    else {
      data = getData(bytes32("transferFrom"), seller, amount);
    }

    _hash = getHash(seller, sell, 0, data);
    require(getSigner(_hash, sellSig) == seller, "Pools/invalid-signer");

    if (way) {
      // IERC20(sell).approve(seller, 0);
      // IERC20(sell).approve(seller, amount);
      transferFrom(sell, seller, amount);
    } else {
      transfer(sell, seller, amount);
    }

    nonce[buyer]++;
    nonce[seller]++;

    require(IERC20(buy).balanceOf(address(this)) == IERC20(sell).balanceOf(address(this)), "Pools/invalid-pairs");
  }

  function swap(
    bytes32 neutral,

    bytes calldata exitSig,
    address exiter,

    bytes calldata joinSig,
    address joiner,

    uint amount,
    bool side
  ) external auth {
    require(amount > 0, "Pools/invalid-amount");
    require(neutrals[neutral].market != address(0), "Pools/market-not-set");
    require(neutrals[neutral].matched >= amount, "Pools/margin-too-small");
    require(cooldown[exiter][neutral] == 0 || now <= cooldown[exiter][neutral], "Pools/exiter-must-wait");
    require(cooldown[joiner][neutral] == 0 || now <= cooldown[joiner][neutral], "Pools/joiner-must-wait");

    cooldown[exiter][neutral] = cooldown[exiter][neutral].add(wait);
    cooldown[joiner][neutral] = cooldown[joiner][neutral].add(wait);

    address party;

    if (side) {
      party = IDeriveContract(neutrals[neutral].market).LONG_POSITION_TOKEN();
    } else {
      party = IDeriveContract(neutrals[neutral].market).SHORT_POSITION_TOKEN();
    }

    require(party != address(0), "Pools/null-market-side");

    uint current = IERC20(party).balanceOf(address(this));

    bytes memory data = getData(bytes32("transfer"), address(0), amount);
    bytes32 _hash;

    _hash = getHash(joiner, party, 0, data);
    require(getSigner(_hash, joinSig) == joiner, "Pools/invalid-signer");
    transferFrom(party, joiner, amount);

    // require(executeCall(party, 0, data), "Pools/could-not-join");

    data = getData(bytes32("transferFrom"), exiter, amount);

    _hash = getHash(exiter, party, 0, data);
    require(getSigner(_hash, exitSig) == exiter, "Pools/invalid-signer");
    transfer(party, exiter, amount);

    // IERC20(party).approve(exiter, 0);
    // IERC20(party).approve(exiter, amount);
    //
    // require(executeCall(party, 0, data), "Pools/could-not-join");

    require(current == IERC20(party).balanceOf(address(this)), "Pool/different-balance");

    nonce[exiter]++;
    nonce[joiner]++;

    emit Swapped(
      neutral,
      exitSig,
      exiter,
      joinSig,
      joiner,
      amount,
      side
    );

  }

  function transferFrom(address token, address from, uint amount) internal {
    IERC20(token).transferFrom(from, address(this), amount);
  }

  function transfer(address token, address to, uint amount) internal {
    IERC20(token).transfer(to, amount);
  }

  function executeCall(address to, uint256 value, bytes memory data) internal returns (bool success) {
    assembly {
       success := call(gas, to, value, add(data, 0x20), mload(data), 0, 0)
    }
  }

  function getData(bytes32 transferType, address to, uint256 amount) public returns (bytes memory) {
    if (transferType == "transfer") {
      return abi.encodeWithSignature("transfer(address,uint256)", address(this), amount);
    } else if (transferType == "transferFrom") {
      return abi.encodeWithSignature("transferFrom(address,address,uint256)", address(this), to, amount);
    }
  }

  function getHash(address signer, address destination, uint value, bytes memory data)
    public view returns (bytes32) {
    return keccak256(abi.encodePacked(
      address(this),
      signer,
      destination,
      value,
      data,
      nonce[signer])
    );
  }

  function getSigner(bytes32 _hash, bytes memory _signature) internal pure returns (address) {
    bytes32 r;
    bytes32 s;
    uint8 v;
    if (_signature.length != 65) {
      return address(0);
    }
    assembly {
      r := mload(add(_signature, 32))
      s := mload(add(_signature, 64))
      v := byte(0, mload(add(_signature, 96)))
    }
    if (v < 27) {
      v += 27;
    }
    if (v != 27 && v != 28) {
      return address(0);
    } else {
      return ecrecover(keccak256(
        abi.encodePacked("\x19Ethereum Signed Message:\n32", _hash)
      ), v, r, s);
    }
  }

}
