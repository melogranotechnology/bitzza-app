import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { WagmiProvider, useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { formatUnits, parseUnits } from 'viem';
import { sepolia } from 'viem/chains';
import { addresses, erc20Abi, isConfigured, swapAbi, wagmiAdapter } from '../reown';

const queryClient = new QueryClient();

function SwapPanel() {
  const { address, isConnected, chainId } = useAccount();
  const [amount, setAmount] = useState('10');
  const [error, setError] = useState('');
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });
  const onSepolia = chainId === sepolia.id;

  let quoteIn = 0n;
  try { quoteIn = parseUnits(amount || '0', 6); } catch { quoteIn = 0n; }

  const read = { query: { enabled: isConnected && onSepolia, refetchInterval: 8000 } };
  const usdc = useReadContract({ address: addresses.quote, abi: erc20Abi, functionName: 'balanceOf', args: [address], ...read });
  const bitz = useReadContract({ address: addresses.bitz, abi: erc20Abi, functionName: 'balanceOf', args: [address], ...read });
  const allowance = useReadContract({ address: addresses.quote, abi: erc20Abi, functionName: 'allowance', args: [address, addresses.swap], ...read });
  const limit = useReadContract({ address: addresses.swap, abi: swapAbi, functionName: 'maxQuoteIn', ...read });
  const paused = useReadContract({ address: addresses.swap, abi: swapAbi, functionName: 'paused', ...read });
  const preview = useReadContract({
    address: addresses.swap, abi: swapAbi, functionName: 'quote', args: [quoteIn],
    query: { enabled: isConnected && onSepolia && quoteIn > 0n },
  });

  const [fee, out] = preview.data ?? [0n, 0n];
  const needsApproval = quoteIn > 0n && (allowance.data ?? 0n) < quoteIn;
  const overLimit = limit.data !== undefined && quoteIn > limit.data;
  const disabled = !isConnected || !onSepolia || quoteIn === 0n || overLimit || paused.data || isPending || receipt.isLoading;

  async function run(label, request) {
    setError('');
    try {
      await writeContractAsync(request);
    } catch (err) {
      setError(`${label}: ${err.shortMessage || err.message}`);
    }
  }

  const { refetch: refetchUsdc } = usdc;
  const { refetch: refetchBitz } = bitz;
  const { refetch: refetchAllowance } = allowance;
  useEffect(() => {
    if (receipt.isSuccess) { refetchUsdc(); refetchBitz(); refetchAllowance(); }
  }, [receipt.isSuccess, refetchUsdc, refetchBitz, refetchAllowance]);

  return (
    <section className="card">
      <p><strong>Rete:</strong> Sepolia (testnet). Token di prova senza valore.</p>
      <div style={{ margin: '12px 0' }}><appkit-button /></div>
      {isConnected && !onSepolia && <p role="alert">Passa il wallet alla rete Sepolia.</p>}
      {isConnected && onSepolia && (
        <>
          <p>mUSDC: {formatUnits(usdc.data ?? 0n, 6)} · tBITZ: {formatUnits(bitz.data ?? 0n, 18)}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
            <button type="button" onClick={() => run('Mint mUSDC', { address: addresses.quote, abi: erc20Abi, functionName: 'mint', args: [address, parseUnits('1000', 6)] })}>Ottieni 1000 mUSDC</button>
            <button type="button" onClick={() => run('Faucet', { address: addresses.bitz, abi: erc20Abi, functionName: 'claimFaucet' })}>Faucet 100 tBITZ</button>
          </div>
          <label>Importo mUSDC
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <p>Ricevi ≈ {formatUnits(out, 18)} tBITZ · commissione {formatUnits(fee, 6)} mUSDC</p>
          {overLimit && <p role="alert">Sopra il limite per scambio ({formatUnits(limit.data, 6)} mUSDC).</p>}
          {paused.data && <p role="alert">Scambi in pausa.</p>}
          {needsApproval ? (
            <button type="button" disabled={disabled} onClick={() => run('Approvazione', { address: addresses.quote, abi: erc20Abi, functionName: 'approve', args: [addresses.swap, quoteIn] })}>
              1. Approva {amount} mUSDC
            </button>
          ) : (
            <button type="button" disabled={disabled} onClick={() => run('Scambio', { address: addresses.swap, abi: swapAbi, functionName: 'swap', args: [quoteIn, (out * 99n) / 100n] })}>
              2. Scambia (slippage max 1%)
            </button>
          )}
          {hash && <p>Tx: {hash.slice(0, 10)}… {receipt.isSuccess ? 'confermata' : 'in attesa'}</p>}
          {error && <p role="alert">{error}</p>}
        </>
      )}
    </section>
  );
}

export default function Swap() {
  return (
    <main className="page" style={{ maxWidth: 560, margin: '0 auto', padding: 16 }}>
      <Link to="/wallet">← Wallet</Link>
      <h1>Scambio testnet (Reown)</h1>
      <p role="note">Prototipo non auditato su Sepolia. Non è BITZZA reale: nessun valore, nessuna mainnet.</p>
      {isConfigured && wagmiAdapter ? (
        <WagmiProvider config={wagmiAdapter.wagmiConfig}>
          <QueryClientProvider client={queryClient}>
            <SwapPanel />
          </QueryClientProvider>
        </WagmiProvider>
      ) : (
        <section className="card">
          <p>Configura <code>frontend/web/.env.local</code> con <code>VITE_REOWN_PROJECT_ID</code> (da dashboard.reown.com), <code>VITE_QUOTE_TOKEN</code>, <code>VITE_BITZ_TOKEN</code> e <code>VITE_SWAP_CONTRACT</code> (output di <code>npm run deploy:sepolia</code> in <code>contracts/</code>).</p>
        </section>
      )}
    </main>
  );
}
