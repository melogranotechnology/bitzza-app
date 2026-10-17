require("@nomicfoundation/hardhat-toolbox");

// Solo testnet: nessuna rete mainnet è configurata di proposito.
const { SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY } = process.env;

module.exports = {
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: SEPOLIA_RPC_URL && DEPLOYER_PRIVATE_KEY
    ? { sepolia: { url: SEPOLIA_RPC_URL, accounts: [DEPLOYER_PRIVATE_KEY] } }
    : {},
};
