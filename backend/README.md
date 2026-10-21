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

| Metodo | Percorso | Note |
|---|---|---|
| POST | `/api/register` | `email`, `password` (≥10), `displayName` |
| POST | `/api/login` | |
| GET | `/api/wallet` | saldo e ultime 20 operazioni |
| GET | `/api/transactions?limit=&before=` | storico con paginazione |
| POST | `/api/transfers` | `toEmail`, `amountMinor`, `memo`; header `Idempotency-Key` |

## Stato

Questa è la fase 1 (conti, registro, trasferimenti). Prossime fasi: ordini e consegne tra utenti, QR firmati dal server, pagamenti in euro con Stripe in modalità test, collegamento dell'app iOS. Il passaggio a fondi reali richiede una società, verifica dell'identità e consulenza legale (vedi `docs/LEGAL-PRODUCT-BRIEF.md`).
