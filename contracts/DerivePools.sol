pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "./interfaces/INeutralJoin.sol";
import "./interfaces/IDeriveContract.sol";
import "./libraries/MathLib.sol";
import "./interfaces/VatLike.sol";

contract DerivePools is Ownable {

  using SafeMath for uint;

  event Joined(
    bytes32 neutral,
    bool way,
    uint delta
  );
  event Swapped(
    bytes32 neutral,

    bytes exitSig,
    address exiter,

    uint amount,
    bool side
  );
  event Filed(bytes32 neutral, bytes32 what, address data);
  event SetLine(bytes32 neutral, uint data);
  event SetWait(uint wait);

  struct Neutral {
    address market;
    address custodian;
    address join;
    uint    matched;
    uint    line;
  }

  uint public wait;

  mapping(bytes32 => Neutral)                                      public neutrals;
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

  constructor() public {}

  function file(bytes32 neutral, bytes32 what, address data) external onlyOwner {
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

  function setLine(bytes32 neutral, uint data) external onlyOwner {
    neutrals[neutral].line = data;
    emit SetLine(neutral, data);
  }

  function setWait(uint data) external onlyOwner {
    wait = data;
    emit SetWait(wait);
  }

  function flip(
    bytes[] calldata buyers,
    bytes[] calldata sellers,
    bytes32 neutral,
    bool way
  ) external onlyOwner {
    require(neutrals[neutral].market != address(0), "Pools/market-not-set");

    uint currentBuy = IERC20(IDeriveContract(neutrals[neutral].market).LONG_POSITION_TOKEN()).balanceOf(address(this));
    uint currentSell = IERC20(IDeriveContract(neutrals[neutral].market).SHORT_POSITION_TOKEN()).balanceOf(address(this));

    for (uint i = 0; i < buyers.length; i++) {
      decompose(neutral, buyers[i], way);
    }

    for (uint i = 0; i < sellers.length; i++) {
      decompose(neutral, sellers[i], way);
    }

    uint delta;

    if (way) {
      delta = IERC20(IDeriveContract(neutrals[neutral].market).LONG_POSITION_TOKEN()).balanceOf(address(this)).sub(currentBuy);
      require(delta == IERC20(IDeriveContract(neutrals[neutral].market).SHORT_POSITION_TOKEN()).balanceOf(address(this)).sub(currentSell));
    } else {
      delta = currentBuy.sub(IERC20(IDeriveContract(neutrals[neutral].market).LONG_POSITION_TOKEN()).balanceOf(address(this)));
      require(delta == currentSell.sub(IERC20(IDeriveContract(neutrals[neutral].market).SHORT_POSITION_TOKEN()).balanceOf(address(this))));
    }

    flow(neutral, delta, way);

    emit Joined(
      neutral,
      way,
      delta
    );
  }

  function decompose(bytes32 neutral, bytes memory order, bool way) internal {
    bytes memory sig;
    address usr;
    uint amount;
    bool side;

    (side, sig, usr, amount) = abi.decode(order, (bool, bytes, address, uint256));

    require(amount > 0, "Pools/invalid-amount");
    require(cooldown[usr][neutral] == 0 || now <= cooldown[usr][neutral], "Pools/usr-must-wait");

    address token;

    if (side) {
      token = IDeriveContract(neutrals[neutral].market).LONG_POSITION_TOKEN();
    } else {
      token = IDeriveContract(neutrals[neutral].market).SHORT_POSITION_TOKEN();
    }

    pool(neutral, way, token, sig, usr, amount);
  }

  function pool(
    bytes32 neutral,
    bool way,
    address token,
    bytes memory sig,
    address usr,
    uint amount
  ) internal {
    require(token != address(0) && usr != address(0), "Pool/token-or-usr-null");

    bytes memory data;
    bytes32 _hash;

    if (way)
      data = getData(bytes32("transfer"), address(0), amount);
    else {
      data = getData(bytes32("transferFrom"), usr, amount);
    }

    _hash = getHash(usr, token, 0, data);
    require(getSigner(_hash, sig) == usr, "Pools/invalid-signer");

    if (way) {
      transferFrom(token, usr, amount);
    } else {
      transfer(token, usr, amount);
    }

    if (way) {
      balances[usr][neutral][token] = balances[usr][neutral][token].add(amount);
    } else {
      balances[usr][neutral][token] = balances[usr][neutral][token].sub(amount);
    }

    cooldown[usr][neutral] = cooldown[usr][neutral].add(wait);
    nonce[usr]++;
  }

  function flow(bytes32 neutral, uint delta, bool way) internal {
    uint underlying = MathLib.multiply(delta, IDeriveContract(neutrals[neutral].market).COLLATERAL_PER_UNIT());
    if (way) {
      neutrals[neutral].matched = neutrals[neutral].matched.add(underlying);
      require(neutrals[neutral].matched <= neutrals[neutral].line, "Pools/above-line");
      INeutralJoin(neutrals[neutral].join).join(neutrals[neutral].custodian, underlying);
    } else {
      neutrals[neutral].matched = neutrals[neutral].matched.sub(underlying);
      INeutralJoin(neutrals[neutral].join).exit(neutrals[neutral].custodian, underlying);
    }
  }

  function swap(
    bytes32 neutral,

    bytes calldata exitSig,
    address exiter,

    bytes[] calldata joiners,

    uint amount,
    bool side
  ) external onlyOwner {
    require(amount > 0, "Pools/invalid-amount");
    require(neutrals[neutral].market != address(0), "Pools/market-not-set");
    require(neutrals[neutral].matched >= amount, "Pools/margin-too-small");
    require(cooldown[exiter][neutral] == 0 || now <= cooldown[exiter][neutral], "Pools/exiter-must-wait");

    cooldown[exiter][neutral] = cooldown[exiter][neutral].add(wait);

    address party;

    if (side) {
      party = IDeriveContract(neutrals[neutral].market).LONG_POSITION_TOKEN();
    } else {
      party = IDeriveContract(neutrals[neutral].market).SHORT_POSITION_TOKEN();
    }

    require(party != address(0), "Pools/null-market-side");

    uint current = IERC20(party).balanceOf(address(this));

    for (uint i = 0; i < joiners.length; i++) {
      grab(neutral, joiners[i], party);
    }

    drain(neutral, exitSig, exiter, party, amount);

    require(current == IERC20(party).balanceOf(address(this)), "Pool/different-balance");

    nonce[exiter]++;

    emit Swapped(
      neutral,
      exitSig,
      exiter,
      amount,
      side
    );
  }

  function grab(bytes32 neutral, bytes memory order, address party) internal {
    bytes32 _hash;

    address joiner;
    uint256 amount;
    bytes memory sig;

    (sig, joiner, amount) = abi.decode(order, (bytes, address, uint256));

    require(amount > 0, "Pools/invalid-amount");

    balances[joiner][neutral][party] = balances[joiner][neutral][party].add(amount);

    _hash = getHash(joiner, party, 0, getData(bytes32("transfer"), address(0), amount));
    require(getSigner(_hash, sig) == joiner, "Pools/invalid-signer");
    transferFrom(party, joiner, amount);

    nonce[joiner]++;
  }

  function drain(bytes32 neutral, bytes memory sig, address exiter, address party, uint amount) internal {
    bytes32 _hash;

    balances[exiter][neutral][party] = balances[exiter][neutral][party].sub(amount);

    _hash = getHash(exiter, party, 0, getData(bytes32("transferFrom"), exiter, amount));
    require(getSigner(_hash, sig) == exiter, "Pools/invalid-exit-signer");
    transfer(party, exiter, amount);
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

  function flipCompose(bool side, bytes memory sig, address usr, uint256 amount) public pure returns (bytes memory composed) {
    composed = abi.encode(side, sig, usr, amount);
  }

  function swapCompose(bytes memory sig, address usr, uint256 amount) public pure returns (bytes memory composed) {
    composed = abi.encode(sig, usr, amount);
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

  function getSigner(bytes32 _hash, bytes memory _signature) public pure returns (address) {
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
