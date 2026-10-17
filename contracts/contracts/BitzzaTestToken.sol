// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice TOKEN DI PROVA per testnet. Non ha valore e non è BITZZA reale.
contract BitzzaTestToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 100_000_000 ether;
    uint256 public constant FAUCET_AMOUNT = 100 ether;
    uint256 public constant FAUCET_COOLDOWN = 1 days;

    bool public immutable faucetEnabled;
    mapping(address => uint256) public lastFaucetClaim;

    error SupplyExceeded();
    error FaucetDisabled();
    error FaucetCooldown(uint256 availableAt);

    constructor(address owner_, bool faucetEnabled_) ERC20("BITZZA Test", "tBITZ") Ownable(owner_) {
        faucetEnabled = faucetEnabled_;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        if (totalSupply() + amount > MAX_SUPPLY) revert SupplyExceeded();
        _mint(to, amount);
    }

    function claimFaucet() external {
        if (!faucetEnabled) revert FaucetDisabled();
        uint256 availableAt = lastFaucetClaim[msg.sender] + FAUCET_COOLDOWN;
        if (lastFaucetClaim[msg.sender] != 0 && block.timestamp < availableAt) {
            revert FaucetCooldown(availableAt);
        }
        if (totalSupply() + FAUCET_AMOUNT > MAX_SUPPLY) revert SupplyExceeded();
        lastFaucetClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
