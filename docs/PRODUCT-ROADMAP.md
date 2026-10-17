# BITZZA product alignment and roadmap

BITZZA is currently a functional, local demo ledger. The vision documents describe a broader service; this table separates what the demo can show from what would require a production system.

| Product theme | Available in the demo | Not implemented / production work |
|---|---|---|
| Pizza as a value unit | Fixed-price, simulated pizza vouchers, single-use codes, customer voucher history, merchant POS redemption, and demo treasury-to-merchant settlement | Real pizza entitlement, real merchants, real funds, refunds, tax, payment processing, and dispute handling |
| Customer wallet and payments | Demo balances, authenticated transfers, transfer idempotency, transaction history/export, and a device-local offline payment intent queue | Blockchain settlement, custody, real-time finality, encrypted device storage, secure key recovery, and verified offline spending |
| Pizzeria as a hub | Demo merchant profile, voucher code validation, one-time redemption, and settlement history | Merchant identity checks, production POS hardware, staff roles, accounting integration, and operating support |
| Local agriculture and traceability | Simulated commodity holdings and market labels; illustrative pizza ingredients and allergen disclosure | Supplier onboarding, verified provenance, food-safety records, nutrition verification, inventory, and auditable supply-chain data |
| Offline operation | Cached application shell; outgoing payments remain pending locally and submit with the same idempotency key when online | Offline authorization or settlement, balance reservation, multi-device conflict resolution, encrypted outbox, and guaranteed delivery |
| Security and trust | Password hashing, JWT authentication, required server secret, server-side balance checks, serialized atomic ledger writes, and demo replay protection | Independent security assessment, threat model, rate limits, MFA, hardware-backed keys, incident response, monitoring, backups, and key rotation |
| Market and mining | Clearly marked simulated values, rewards, and cooldowns | Tradable assets, token contract, mining infrastructure, independent price sources, and energy accounting |

## Demo behavior and limitations

- Initial wallet balances, BITZ, mining rewards, commodity pricing, market data, voucher price, and merchant settlement are simulated ledger entries.
- A demo voucher is not a promise or guarantee of a real pizza. Its ingredient and allergen text is illustrative and must be checked with a real seller.
- Offline payment data is stored in browser local storage, scoped to the signed-in account's email. This is not encrypted or tamper-proof. A queued payment is not complete, does not reserve funds, and can be rejected by the server. Do not queue sensitive payment details or use real funds.
- The service worker caches only the application shell and static build assets. It does not cache authenticated API responses or turn offline activity into settlement.
- The demo is not a cryptocurrency wallet, blockchain, banking service, merchant acquiring service, or food-safety source.

## Selected direction for a future real-money product

The current product direction, selected by the project owner, is:

- Initial market: Italy and the EU.
- Wallet: non-custodial, with users controlling their own signing keys.
- BITZ: a transferable crypto-asset intended to be exchangeable and have a market value.
- Proposed v1 app scope: wallet creation/import, receiving, and sending only; no in-app purchase/sale or exchange access, vouchers, or merchant payments.

These are product assumptions, not legal conclusions or authorization to issue, offer, list, or trade a token. The token's final legal classification, issuer, distribution, governance, and permitted services remain undecided. A non-custodial wallet does not by itself settle whether the issuer, app, or any connected service has regulatory obligations. The demo balance and vouchers must not be converted into, or represented as, real tokens or redeemable claims.

See [the legal and product briefing for counsel](./LEGAL-PRODUCT-BRIEF.md) for the selected assumptions and questions for counsel, and [the production requirements and release gates](./PRODUCTION-REQUIREMENTS.md) for staged acceptance criteria and current blockers.

Before any public token offer, listing, real-money feature, or mainnet deployment, obtain specialist Italy/EU legal advice on the token and each service in the intended flow. In particular, assess MiCA classification and applicable offer/admission disclosures, whether any activity is a regulated crypto-asset service, and whether other financial-services or payments rules apply. MiCA distinguishes crypto-assets other than asset-referenced tokens and e-money tokens from those separately regulated categories; classification depends on the actual rights, stabilization mechanisms, and design, not the token name. See the [MiCA Regulation (EU) 2023/1114](https://eur-lex.europa.eu/eli/reg/2023/1114/oj) and [ESMA's MiCA information and register](https://www.esma.europa.eu/esmas-activities/digital-finance-and-innovation/markets-crypto-assets-regulation-mica). This is a product-planning checklist, not legal advice.

### Release gates

1. **Legal and product specification:** obtain a written classification and service-perimeter assessment from qualified counsel; decide the issuer, token rights and supply policy, distribution, market-access model, disclosures, and consumer protections. Assess the selected wallet-only v1 first; treat any later voucher or merchant-payment integration as a separate decision.
2. **Wallet and chain architecture:** select a supported network only after the product and risk requirements are agreed. Specify key generation, backup/recovery, transaction signing, chain/network validation, fees, account-abstraction or smart-account needs, and lost-device support. Never reuse demo credentials or treat a server-side demo balance as an on-chain balance.
3. **Testnet implementation:** implement the wallet and contracts against test assets only, with threat modeling, invariant and integration tests, independent contract/security reviews, dependency and deployment controls, and operational procedures. Keep admin powers, upgradeability, mint/burn, pause, and recovery behavior explicit and independently reviewed.
4. **Controlled pilot readiness:** complete legal sign-off, security findings remediation, key-recovery drills, monitoring and incident response, support/refund/dispute processes, and merchant/accounting workflows. Start with a limited, opt-in pilot only when the required approvals and partners are in place.
5. **Mainnet release:** require documented approval at every gate, production key custody procedures for issuer/admin keys, verified deployment artifacts, a rollback/incident plan, and a separately reviewed launch checklist. Do not bridge demo balances, enable real funds, or market a token as stable or redeemable unless the approved design and legal basis expressly support that claim.

No mainnet token, real-funds flow, or production wallet security is implemented in this repository. The existing demo remains isolated from any future production token system.

## Before production

1. Define the legal and financial model, the meaning and redeemability of a pizza unit, merchant obligations, consumer disclosures, refunds, taxes, and dispute resolution.
2. Design the ledger and settlement around integer minor units, auditable immutable entries, reconciliation, concurrency controls, and independently reviewed invariants.
3. Select a regulated payment provider and decide custody, token issuance, identity verification, sanctions screening, accounting, and jurisdictional requirements.
4. Complete a threat model and independent security review; add rate limiting, MFA, secure session management, secrets management, key recovery, logging/alerting, backup/restore, and incident response.
5. Design offline behavior explicitly: protected device storage, expiry, limits, reconciliation, duplicate/conflict handling, and clear user consent. Never treat an unvalidated offline intent as settled.
6. Onboard and verify real agricultural suppliers and pizzerias. Collect and maintain traceable provenance, inventory, ingredient, allergen, and nutrition data with appropriate review.
7. Validate accessibility, localization, device/browser coverage, load, operational resilience, and end-to-end user journeys with real stakeholders before launch.
