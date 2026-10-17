# BITZZA contratti (SOLO TESTNET)

Prototipo non auditato. `tBITZ` e `mUSDC` sono token di prova **senza valore**: non sono BITZZA reale.
Mainnet/token reali restano bloccati dai cancelli in `docs/PRODUCTION-REQUIREMENTS.md` e `docs/LEGAL-PRODUCT-BRIEF.md`
(token, rete, parere legale MiCA, audit esterno).

- `BitzzaTestToken`: ERC-20 con supply massima, faucet con cooldown.
- `MockUSDC`: stablecoin finta a 6 decimali.
- `BitzzaSwap`: prezzo fisso, commissione max 5%, limite per scambio, slippage, pausa, Ownable2Step, ReentrancyGuard.

```bash
cd contracts && npm install && npm test
SEPOLIA_RPC_URL=... DEPLOYER_PRIVATE_KEY=... npm run deploy:sepolia   # usa una chiave di test dedicata
```

Poi in `frontend/web/.env.local` (non committare): `VITE_REOWN_PROJECT_ID` (dashboard.reown.com), `VITE_QUOTE_TOKEN`,
`VITE_BITZ_TOKEN`, `VITE_SWAP_CONTRACT`. Avvia `npm run dev:web` e apri `/swap`.
