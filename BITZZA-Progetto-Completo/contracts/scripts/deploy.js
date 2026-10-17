const { ethers } = require("hardhat");

// Solo testnet. Stampa gli indirizzi da copiare in frontend/web/.env.local.
async function main() {
  const [deployer] = await ethers.getSigners();
  const usdc = await (await ethers.getContractFactory("MockUSDC")).deploy();
  const bitz = await (await ethers.getContractFactory("BitzzaTestToken")).deploy(deployer.address, true);
  const swap = await (await ethers.getContractFactory("BitzzaSwap")).deploy(
    deployer.address, usdc, bitz, 12_500_000n, 30, 1_000n * 10n ** 6n, deployer.address,
  );
  await bitz.mint(await swap.getAddress(), ethers.parseEther("1000000"));
  console.log(`VITE_QUOTE_TOKEN=${await usdc.getAddress()}`);
  console.log(`VITE_BITZ_TOKEN=${await bitz.getAddress()}`);
  console.log(`VITE_SWAP_CONTRACT=${await swap.getAddress()}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
