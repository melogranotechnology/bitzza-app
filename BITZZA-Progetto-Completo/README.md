# BITZZA Wallet

## Run locally

1. Install backend dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set `JWT_SECRET` to a unique random value of at least 32 characters.
3. Start the API with `npm start` (health endpoint: `http://localhost:3000/health`).
4. In another terminal, run `cd frontend/web && npm install && npm run dev`.

The frontend uses `http://localhost:3000/api` by default. Set `VITE_API_URL` in the frontend environment if the API is hosted elsewhere; it should include the `/api` path.

The dashboard supports registration and login, account balance with address-copy and quick-send actions, transfers, transaction search/filter and export, contacts, commodity buying/selling, mining rewards/cooldowns, simulated token/market data, saved user preferences, simulated pizzeria onboarding and POS settlement, and fixed-price demo pizza vouchers. Transfer and voucher purchase requests support safe idempotent retries. The responsive wallet navigation, first-use activity state, and privacy-aware greeting help users find their way around.

The installed app shell is cached for navigation while offline. Outgoing payments made offline are stored in browser local storage per account and remain visibly pending until the API validates them; they do not reserve balance or count as transactions. They synchronize when the connection returns and can be retried if rejected. API responses and wallet balances are never cached by the service worker.

Run the full validation set with `npm run check`. To run individual frontend commands from the repository root, use `npm run lint:web` and `npm run build:web`.

This is a functional demo ledger, not a production cryptocurrency wallet. Initial balances, mining rewards, commodity prices, token metadata, and market prices are simulated; there is no blockchain connection, custody, fiat payment, or real asset trading. Do not use it to hold or transfer real funds. For production use, a separate security, financial, legal, deployment, and recovery design is required.

See [docs/PRODUCT-ROADMAP.md](./docs/PRODUCT-ROADMAP.md) for the product-document alignment, demo boundaries, and production prerequisites.

## Native iOS app (SwiftUI)

Open [the native iOS project](./ios/Bitzza.xcodeproj) in Xcode and run the **Bitzza** scheme on an iOS 17+ simulator or a physical iPhone. Use **Entra nella demo offline** to explore the SwiftUI wallet without an account, API server, or internet connection; local demo changes persist on that device and can be reset in Settings. API-backed login and registration are still available when the server is running. For setup and behavior details, see the [iOS README](./ios/README.md).

The iOS app, like the web app, is a demo ledger. Its offline activity is stored only on the device and is not synchronized; no mode creates or manages blockchain keys or transfers real funds.

The native MetaMask-style connection and BITZ/USDC swap screen is also a UI simulation. It does not connect to MetaMask, use a real BITZ token, sign transactions, or access a decentralized exchange.

For the vision in the supplied business plan and an assessment of its assumptions, see [docs/BUSINESS-PLAN-REVIEW.md](./docs/BUSINESS-PLAN-REVIEW.md). The original BITZZA artwork is used in the app shell, sign-in screens, and wallet opening screen.

The proposed real-token direction is still at requirements and legal-review stage. See [docs/LEGAL-PRODUCT-BRIEF.md](./docs/LEGAL-PRODUCT-BRIEF.md) and [docs/PRODUCTION-REQUIREMENTS.md](./docs/PRODUCTION-REQUIREMENTS.md) for unresolved decisions and release gates. Do not use the demo for real funds.
