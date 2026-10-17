# BITZZA iOS

## Open and run

1. Open `Bitzza.xcodeproj` in Xcode.
2. Select the shared **Bitzza** scheme and an iPhone simulator (iOS 17 or later).
3. Start the existing API from the repository root in Terminal with `npm start` and leave it running.
4. Build and run from Xcode. Tap **Entra nella demo offline** to try the native app without creating an account, starting the API, or connecting to the internet. The existing account login/registration remains available for the API-backed demo.

The simulator automatically connects to the Mac API at `http://127.0.0.1:3000/api`. The project also has a LAN address configured for a physical iPhone; if the Mac's network changes, update `BITZZA_API_BASE_URL` in the target Build Settings to `http://<MAC-LAN-IP>:3000/api`. For a physical iPhone, allow local-network access and connect the phone and Mac to the same network.

If the iPhone says it cannot connect, first open `http://172.20.10.13:3000/health` in Safari on the iPhone. A JSON response with `"status":"OK"` confirms the network path to the API works. If Safari cannot open it, check that the API is running (`npm start`), both devices are on the same Wi-Fi, Local Network access is allowed for BITZZA in iOS Settings, and the Mac's firewall allows incoming connections. If the Mac's IP has changed, update `BITZZA_API_BASE_URL` in the Xcode target Build Settings to the Mac's current LAN IP, then rebuild and reinstall the app.

## Native demo features

- Fully offline demo entry without login or API access. The sample wallet, contacts, market, rewards, commodities, pizza vouchers/POS and preferences operate locally; local changes persist on this iPhone and can be reset from Settings.
- MetaMask-style connection and USDC/BITZ swap flow are simulations only, with an indicative quote, amount shortcuts, direction switch, and clearable local history. No MetaMask app is opened or connected, no seed phrase is requested, and no transaction is signed or broadcast.
- Login and registration through the existing API; session token stored in iOS Keychain.
- Wallet balance, demo address copy, recent transactions, filtering, privacy display, and demo transfers.
- Contacts, simulated market chart and target, virtual commodity trades, reward cooldowns, demo pizza vouchers and POS profile/redemption, and account preferences.
- Pull to refresh, native tab/navigation patterns, and light/dark/system appearance with adaptive cards and text colors.

All balances, market values, rewards, commodities, vouchers, and transfers are simulated. In offline mode, changes are saved only on the device and are not synchronized with the API or other devices. The app does not create blockchain keys, use a blockchain, or transfer real funds.

Run the web/API regression suite from the repository root with `npm run check`.

## Funzioni "ecosistema" (demo offline)

Tutte simulate, salvate solo sul dispositivo, nessun fondo reale:
- **Pagamento QR**: ricevi/paga con `bitzza://pay` (legge anche `ethereum:`, `bitcoin:`, `solana:`).
- **Pizza-to-earn**: QR `bitzza://earn` della pizzeria, 1 BITZ demo, 1/giorno per pizzeria, max 3/giorno.
- **Consegne SpesaGo**: da corriere guadagni tariffa del mezzo (€/km + €/kg del prototipo SpesaGo) + bonus, max 5/giorno.
- **Spesa a casa**: ordini e paghi in BITZ con preventivo (spesa + corriere + commissione 0,17%), cashback 2% (max 5) alla consegna.
- **Livelli e badge**: XP, serie giornaliera e traguardi calcolati dalle attività.
