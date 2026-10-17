// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice PROTOTIPO per testnet: scambio a prezzo fisso quote -> BITZ dalla liquidità del contratto.
/// Non revisionato né auditato. Non usare con fondi reali.
contract BitzzaSwap is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_FEE_BPS = 500;

    IERC20 public immutable quoteToken;
    IERC20 public immutable bitzToken;

    /// quote atomiche (es. 6 decimali) richieste per 1 BITZ intero (1e18).
    uint256 public price;
    uint256 public feeBps;
    uint256 public maxQuoteIn;
    address public feeRecipient;

    event Swapped(address indexed user, uint256 quoteIn, uint256 fee, uint256 bitzOut);
    event ConfigUpdated(uint256 price, uint256 feeBps, uint256 maxQuoteIn, address feeRecipient);
    event Withdrawn(address indexed token, address indexed to, uint256 amount);

    error InvalidConfig();
    error ZeroAmount();
    error AboveLimit();
    error Slippage(uint256 out, uint256 minOut);
    error InsufficientLiquidity();

    constructor(
        address owner_,
        IERC20 quoteToken_,
        IERC20 bitzToken_,
        uint256 price_,
        uint256 feeBps_,
        uint256 maxQuoteIn_,
        address feeRecipient_
    ) Ownable(owner_) {
        if (address(quoteToken_) == address(0) || address(bitzToken_) == address(0)) revert InvalidConfig();
        quoteToken = quoteToken_;
        bitzToken = bitzToken_;
        _setConfig(price_, feeBps_, maxQuoteIn_, feeRecipient_);
    }

    function quote(uint256 quoteIn) public view returns (uint256 fee, uint256 bitzOut) {
        fee = (quoteIn * feeBps) / BPS;
        bitzOut = ((quoteIn - fee) * 1e18) / price;
    }

    function swap(uint256 quoteIn, uint256 minBitzOut) external nonReentrant whenNotPaused returns (uint256 bitzOut) {
        if (quoteIn == 0) revert ZeroAmount();
        if (quoteIn > maxQuoteIn) revert AboveLimit();
        uint256 fee;
        (fee, bitzOut) = quote(quoteIn);
        if (bitzOut < minBitzOut || bitzOut == 0) revert Slippage(bitzOut, minBitzOut);
        if (bitzToken.balanceOf(address(this)) < bitzOut) revert InsufficientLiquidity();

        quoteToken.safeTransferFrom(msg.sender, address(this), quoteIn - fee);
        if (fee > 0) quoteToken.safeTransferFrom(msg.sender, feeRecipient, fee);
        bitzToken.safeTransfer(msg.sender, bitzOut);
        emit Swapped(msg.sender, quoteIn, fee, bitzOut);
    }

    function setConfig(uint256 price_, uint256 feeBps_, uint256 maxQuoteIn_, address feeRecipient_) external onlyOwner {
        _setConfig(price_, feeBps_, maxQuoteIn_, feeRecipient_);
    }

    function withdraw(IERC20 token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert InvalidConfig();
        token.safeTransfer(to, amount);
        emit Withdrawn(address(token), to, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _setConfig(uint256 price_, uint256 feeBps_, uint256 maxQuoteIn_, address feeRecipient_) private {
        if (price_ == 0 || feeBps_ > MAX_FEE_BPS || maxQuoteIn_ == 0 || feeRecipient_ == address(0)) {
            revert InvalidConfig();
        }
        price = price_;
        feeBps = feeBps_;
        maxQuoteIn = maxQuoteIn_;
        feeRecipient = feeRecipient_;
        emit ConfigUpdated(price_, feeBps_, maxQuoteIn_, feeRecipient_);
    }
}
