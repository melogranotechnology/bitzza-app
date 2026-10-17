import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { sepolia } from '@reown/appkit/networks';

export const projectId = import.meta.env.VITE_REOWN_PROJECT_ID;
export const addresses = {
  quote: import.meta.env.VITE_QUOTE_TOKEN,
  bitz: import.meta.env.VITE_BITZ_TOKEN,
  swap: import.meta.env.VITE_SWAP_CONTRACT,
};
export const isConfigured = Boolean(projectId && addresses.quote && addresses.bitz && addresses.swap);

const networks = [sepolia];
export const wagmiAdapter = projectId
  ? new WagmiAdapter({ networks, projectId })
  : null;

if (wagmiAdapter) {
  createAppKit({
    adapters: [wagmiAdapter],
    networks,
    projectId,
    metadata: {
      name: 'BITZZA Testnet',
      description: 'Prototipo testnet: token di prova senza valore',
      url: window.location.origin,
      icons: [`${window.location.origin}/bitzza-logo-original.png`],
    },
    features: { analytics: false, email: false, socials: false },
  });
}

export const erc20Abi = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'mint', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'claimFaucet', stateMutability: 'nonpayable', inputs: [], outputs: [] },
];

export const swapAbi = [
  { type: 'function', name: 'quote', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ name: 'fee', type: 'uint256' }, { name: 'bitzOut', type: 'uint256' }] },
  { type: 'function', name: 'swap', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }, { type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'paused', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'maxQuoteIn', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
];
