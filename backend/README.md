# BITZZA Backend (Postgres)

Backend reale e separato dalla demo (`server.js`): database Postgres persistente, registro contabile a doppia scrittura, auth JWT.

## Garanzie

- **Doppia scrittura**: ogni transazione ha voci che sommano a 0, verificato dal database al commit.
- **Registro immutabile**: `ledger_entries` non accetta UPDATE né DELETE.
- **Niente saldi negativi** per i conti utente (vincolo `CHECK` nel database).
- **Idempotenza**: `POST /api/transfers` richiede l'header `Idempotency-Key`; un ritentativo non duplica il pagamento.
- **Concorrenza**: i conti sono bloccati in ordine fisso, senza deadlock né fondi persi (test con 30 trasferimenti incrociati).
- **Audit**: `auditBalances` confronta i saldi in cache con la somma delle voci.
- Importi sempre in unità minime intere (`100` = 1.00 BITZ).

## Avvio locale

```bash
createdb bitzza
cd backend && npm install
cp .env.example .env     # DATABASE_URL=postgresql://localhost/bitzza e JWT_SECRET
npm run migrate && npm start
npm test                 # usa il database bitzza_test (o TEST_DATABASE_URL)
```

## Supabase (gratuito)

1. Crea un progetto su https://supabase.com.
2. **Project Settings → Database → Connection string → URI** (usa il pooler "Session"). Sostituisci `[YOUR-PASSWORD]`.
3. Imposta `DATABASE_URL`, `JWT_SECRET` e `CORS_ORIGINS` come variabili d'ambiente del servizio. Non metterle mai nel repo.
4. Al primo avvio il server crea le tabelle da solo (`db/schema.sql`).

## API

Compatibile con le app esistenti (web e iOS), che usano questo backend senza modifiche al formato.

| Metodo | Percorso | Note |
|---|---|---|
| POST | `/api/register`, `/api/login` | email e password (≥ 8); restituiscono `token` |
| GET | `/api/profile`, `/api/balance` | saldo in BITZ con due decimali |
| POST | `/api/send` | `amount`, `recipientEmail`, `description`; header `Idempotency-Key` |
| GET | `/api/transactions` | `limit`, `offset`, `type=sent\|received`, `search` |
| GET/POST/DELETE | `/api/address-book` | contatti |
| GET/PUT | `/api/user/settings` | impostazioni |
| GET | `/api/token/info`, `/api/market/*`, `/api/pizza/menu`, `/api/pizza/target` | dati di mercato simulati |
| GET | `/api/wallet`, `/api/wallet/export` | riepilogo ed esportazione |

Voucher pizza, pizzerie, mining e materie prime non sono ancora portati sul registro reale: le letture restano vuote e le azioni rispondono `501`.

## Stato

Questa è la fase 1 (conti, registro, trasferimenti). Prossime fasi: ordini e consegne tra utenti, QR firmati dal server, pagamenti in euro con Stripe in modalità test, collegamento dell'app iOS. Il passaggio a fondi reali richiede una società, verifica dell'identità e consulenza legale (vedi `docs/LEGAL-PRODUCT-BRIEF.md`).

## Fase 2 — Ordini con escrow (`/api/orders`)

Tutte le rotte richiedono il token. Il prezzo è calcolato dal server (stessa formula dell'app iOS).

| Metodo | Percorso | Descrizione |
|---|---|---|
| POST | `/api/orders` | Crea l'ordine (header `Idempotency-Key`); il totale va in escrow |
| GET | `/api/orders/mine` · `/available` · `/deliveries` | Miei ordini · ordini aperti · consegne che sto facendo |
| POST | `/api/orders/:id/accept` | Un corriere accetta (atomico, uno solo vince) |
| POST | `/api/orders/:id/advance` | `{expectedStatus}`: accepted → shopping → delivering → delivered |
| POST | `/api/orders/:id/release` | Il corriere rinuncia prima di iniziare |
| POST | `/api/orders/:id/cancel` | Il cliente annulla finché è aperto (rimborso) |

Alla consegna, in una sola transazione: escrow → corriere (spesa + compenso), escrow → piattaforma (commissione), treasury → cliente (cashback).
Pizza merchants, voucher, mining e commodities non sono portati sul ledger reale (GET vuoti, POST 501).
