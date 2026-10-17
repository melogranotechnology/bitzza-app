const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("BITZZA testnet prototype", () => {
  let owner, user, treasury, usdc, bitz, swap;
  const PRICE = 12_500_000n; // 12,5 mUSDC per 1 tBITZ
  const usd = (n) => BigInt(n) * 10n ** 6n;

  beforeEach(async () => {
    [owner, user, treasury] = await ethers.getSigners();
    usdc = await (await ethers.getContractFactory("MockUSDC")).deploy();
    bitz = await (await ethers.getContractFactory("BitzzaTestToken")).deploy(owner.address, true);
    swap = await (await ethers.getContractFactory("BitzzaSwap")).deploy(
      owner.address, usdc, bitz, PRICE, 30, usd(1000), treasury.address,
    );
    await bitz.mint(await swap.getAddress(), ethers.parseEther("10000"));
    await usdc.connect(user).mint(user.address, usd(1000));
    await usdc.connect(user).approve(await swap.getAddress(), usd(1000));
  });

  it("scambia applicando commissione e prezzo", async () => {
    const [fee, out] = await swap.quote(usd(125));
    expect(fee).to.equal(375_000n);
    await expect(swap.connect(user).swap(usd(125), out)).to.emit(swap, "Swapped");
    expect(await bitz.balanceOf(user.address)).to.equal(out);
    expect(await usdc.balanceOf(treasury.address)).to.equal(fee);
  });

  it("rispetta slippage, limite e pausa", async () => {
    const [, out] = await swap.quote(usd(100));
    await expect(swap.connect(user).swap(usd(100), out + 1n)).to.be.revertedWithCustomError(swap, "Slippage");
    await expect(swap.connect(user).swap(usd(1001), 0)).to.be.revertedWithCustomError(swap, "AboveLimit");
    await swap.pause();
    await expect(swap.connect(user).swap(usd(100), 0)).to.be.revertedWithCustomError(swap, "EnforcedPause");
  });

  it("fallisce senza liquidità", async () => {
    await swap.withdraw(bitz, owner.address, ethers.parseEther("10000"));
    await expect(swap.connect(user).swap(usd(100), 0)).to.be.revertedWithCustomError(swap, "InsufficientLiquidity");
  });

  it("solo il proprietario configura e la commissione è limitata", async () => {
    await expect(swap.connect(user).setConfig(PRICE, 30, usd(1), user.address))
      .to.be.revertedWithCustomError(swap, "OwnableUnauthorizedAccount");
    await expect(swap.setConfig(PRICE, 501, usd(1), treasury.address))
      .to.be.revertedWithCustomError(swap, "InvalidConfig");
  });

  it("faucet con cooldown e limite supply sul mint", async () => {
    await bitz.connect(user).claimFaucet();
    expect(await bitz.balanceOf(user.address)).to.equal(ethers.parseEther("100"));
    await expect(bitz.connect(user).claimFaucet()).to.be.revertedWithCustomError(bitz, "FaucetCooldown");
    await time.increase(86400);
    await bitz.connect(user).claimFaucet();
    await expect(bitz.mint(owner.address, ethers.parseEther("100000000"))).to.be.revertedWithCustomError(bitz, "SupplyExceeded");
  });
});
