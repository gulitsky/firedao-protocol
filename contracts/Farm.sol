// SPDX-License-Identifier: AGPL-3.0

pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import {IVault} from "./Vault.sol";

interface IFire is IERC20 {
    function mint(address dst, uint256 rawAmount) external;

    function seize(address src, uint256 rawAmount) external;
}

interface IFarm {
    function deposit(address account, uint256 amount) external;

    function withdraw(address account, uint256 amount) external;

    function transfer(address sender, address recipient, uint256 amount) external;
}

contract Farm is IFarm, Ownable {
    using SafeERC20 for IERC20Metadata;
    using SafeERC20 for IFire;

    struct User {
        uint256 shares;
        uint256 rewardDebt;
    }

    struct Pool {
        IERC20 token;
        uint256 sharesTotal;
        uint256 allocPoint;
        uint256 lastRewardBlock;
        uint256 accFirePerShare;
    }

    uint256 public constant FIRE_MAX_SUPPLY = 1650000e18;
    uint256 public constant FIRE_PER_BLOCK = 1909722222222222222;
    uint256 public constant START_BLOCK = 10000000;

    uint256 public vaultsCount;

    IFire public immutable fire;
    mapping(IERC20Metadata => mapping(IERC20Metadata => IVault)) public vaults;
    mapping(IVault => bool) public vaultStatuses;
    mapping(IERC20Metadata => Pool) public pools;
    mapping(IERC20Metadata => mapping(address => User)) public users;
    uint256 public totalAllocPoint;

    event Deposit(address indexed user, IERC20Metadata indexed pool, uint256 amount);
    event Withdraw(address indexed user, IERC20Metadata indexed pool, uint256 amount);
    event Claim(address indexed user, IERC20Metadata indexed pool, uint256 amount);

    modifier onlyVaults {
        require(vaultStatuses[IVault(msg.sender)], "FIREDAO: Only vault allowed");
        _;
    }

    constructor(IFire _fire) {
        fire = _fire;
    }

    function addVault(IVault vault) external onlyOwner {
        require(!vaultStatuses[vault], "FIREDAO: Vault already exists");

        IERC20Metadata underlying = vault.underlying();
        IERC20Metadata target = vault.target();

        vaults[underlying][target] = vault;
        vaultStatuses[vault] = true;
        vaultsCount++;
    }

    function addPool(IERC20Metadata token, uint256 allocPoint) external onlyOwner {
        uint256 lastRewardBlock = block.number > START_BLOCK ? block.number : START_BLOCK;
        totalAllocPoint += allocPoint;
        pools[token] = Pool({
            token: token,
            sharesTotal: 0,
            allocPoint: allocPoint,
            lastRewardBlock: lastRewardBlock,
            accFirePerShare: 0
        });
    }

    function setPool(IERC20Metadata token, uint256 allocPoint) external onlyOwner {
        totalAllocPoint = totalAllocPoint - pools[token].allocPoint + allocPoint;
        pools[token].allocPoint = allocPoint;
    }

    function deposit(address account, uint256 amount) public override onlyVaults {
        IVault vault = IVault(msg.sender);
        IERC20Metadata underlying = vault.underlying();

        updatePool(underlying);
        Pool memory pool = pools[underlying];
        User storage user = users[underlying][account];

        uint256 shares = user.shares;
        if (shares > 0) {
            uint256 pending = ((shares * pool.accFirePerShare) / 1e12) - user.rewardDebt;
            if (pending > 0) {
                fire.safeTransfer(account, pending);
            }
        }

        if (amount > 0) {
            user.shares += amount;
        }

        user.rewardDebt = (user.shares * pool.accFirePerShare) / 1e12;
        emit Deposit(account, underlying, amount);
    }

    function withdraw(address account, uint256 amount) public override onlyVaults {
        IVault vault = IVault(msg.sender);
        IERC20Metadata underlying = vault.underlying();

        updatePool(underlying);
        Pool memory pool = pools[underlying];
        User storage user = users[underlying][account];

        require(user.shares > 0, "user.shares is 0");
        require(pool.sharesTotal > 0, "pool.sharesTotal is 0");

        // Withdraw pending FIRE
        uint256 pending = ((user.shares * pool.accFirePerShare) / 1e12) - user.rewardDebt;
        if (pending > 0) {
            fire.safeTransfer(account, pending);
        }

        if (amount > user.shares) {
            user.shares = 0;
        } else {
            user.shares -= amount;
        }

        user.rewardDebt = (user.shares * pool.accFirePerShare) / 1e12;
        emit Withdraw(account, underlying, amount);
    }

    function transfer(address sender, address recipient, uint256 amount) external override onlyVaults {
        withdraw(sender, amount);
        deposit(recipient, amount);
    }

    function claim(IERC20Metadata token) external {
        updatePool(token);
        Pool memory pool = pools[token];
        User storage user = users[token][msg.sender];

        uint256 pending = ((user.shares * pool.accFirePerShare) / 1e12) - user.rewardDebt;
        if (pending > 0) {
            fire.safeTransfer(msg.sender, pending);
        }

        user.rewardDebt = (user.shares * pool.accFirePerShare) / 1e12;
    }

    function sweep(IERC20Metadata token) external onlyOwner {
        require(address(token) != address(fire), "LiquidityMining: sweeping of FIRE token not allowed");
        token.safeTransfer(owner(), token.balanceOf(address(this)));
    }

    function pendingFire(IERC20Metadata token, address account) external view returns (uint256) {
        Pool memory pool = pools[token];
        User memory user = users[token][account];
        uint256 accFirePerShare = pool.accFirePerShare;
        uint256 sharesTotal = pool.sharesTotal;
        if (block.number > pool.lastRewardBlock && sharesTotal != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 fireReward = (multiplier * FIRE_PER_BLOCK * pool.allocPoint) / totalAllocPoint;
            accFirePerShare += (fireReward * 1e12) / sharesTotal;
        }
        return ((user.shares * accFirePerShare) / 1e12) - user.rewardDebt;
    }

    function updatePool(IERC20Metadata token) public {
        Pool storage pool = pools[token];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 sharesTotal = pool.sharesTotal;
        if (sharesTotal == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        if (multiplier <= 0) {
            return;
        }
        uint256 fireReward = (multiplier * FIRE_PER_BLOCK * pool.allocPoint) / totalAllocPoint;
        fire.mint(address(this), fireReward);

        pool.accFirePerShare += (fireReward * 1e12) / sharesTotal;
        pool.lastRewardBlock = block.number;
    }

    function getMultiplier(uint256 from, uint256 to) public view returns (uint256) {
        if (fire.totalSupply() >= FIRE_MAX_SUPPLY) {
            return 0;
        }
        return to - from;
    }
}
