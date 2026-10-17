# BITZZA production requirements and release gates

## Status and scope

This is a planning and acceptance checklist for the proposed Italy/EU, non-custodial BITZ wallet. BITZ is currently intended to be transferable and exchangeable, but the token design and legal classification are unresolved. This document is not legal advice or a launch authorization.

The repository currently implements a simulated demo ledger. It does not implement a blockchain wallet or real-money service. Keep the demo isolated; do not convert demo accounts, balances, mining rewards, market values, or vouchers into production assets or claims.

Production work must proceed in gated stages. Items marked **BLOCKED** require a decision or evidence before implementation or release. Do not interpret a later-stage checklist as approval to skip earlier gates.

## Proposed v1 boundary

The project owner has selected a wallet-only initial app scope:

- Create or import a non-custodial BITZ wallet.
- Receive and send BITZ on a network that is still to be selected.
- Do not include in-app BITZ purchase/sale, exchange access, pizza vouchers, or merchant payments in v1.
- Do not include demo mining/rewards, simulated market prices, or offline payment authorization in v1.

The broader intention for BITZ to be transferable and exchangeable is not a decision to provide trading in the app, nor a legal conclusion. Whether external trading or a later app feature is permitted remains subject to the token design and written legal assessment. This scope boundary does not determine the token's regulatory classification.

## Launch definition

The phrase “finished app” must refer to a specific release:

| Stage | Intended use | Release boundary |
|---|---|---|
| Demo (current) | Demonstrate product journeys | Simulated balances and merchant settlement only; no real token, funds, keys, or claims |
| Testnet prototype | Validate wallet and contract behavior | Test assets only; prominently label the network and assets; no public sale or real-value claims |
| Controlled pilot | Validate a legally approved product with selected users/partners | Only after written legal, security, compliance, and operational sign-off; limited access and explicit support processes |
| Public production | Serve the approved public product | Only after all release gates below have evidence, owners, and approval |

## Product requirements

### PR-1: Product and asset definition — BLOCKED

- Publish a user-flow and asset-flow specification for v1: wallet creation/import, receiving, sending, and recovery. Document excluded flows (buy/sell, exchange access, rewards, vouchers, merchant payment, and refunds) separately as out of scope.
- For each asset, specify issuer, legal rights, transferability, supply, issuance/burn authority, fees, redemption terms, and what happens if a merchant or service stops operating.
- State plainly whether BITZ is a payment asset, a voucher/reward mechanism, a market asset, or some combination. Do not infer this from the demo.
- Define initial supported users, age/eligibility rules, countries, languages, accessibility target, and customer-support model.
- Record what is excluded from v1, including in-app exchange/buy/sell, fiat on/off-ramp, rewards, vouchers, merchant payments, bridges, yield, lending, and offline authorization. Adding any excluded flow requires a separate product decision and review.

**Acceptance evidence:** approved product specification and flow diagrams; asset and responsibility matrix; explicit out-of-scope list; product-owner sign-off.

### PR-2: Legal and regulatory perimeter — BLOCKED

- Obtain qualified Italy/EU counsel's written assessment of the final token rights and each service in scope, including relevant MiCA categories, other financial-services/payment regimes, offer and admission requirements, marketing, and the roles of issuer, app operator, merchants, and providers.
- Obtain a country-by-country launch perimeter and a list of required authorizations, registrations, disclosures, contracts, controls, and external partners.
- Have counsel review customer/merchant terms, risk statements, voucher and refund terms, privacy notices, and product claims before publication.
- Confirm the current applicable EU and Italian laws, implementing measures, and supervisory guidance at each release gate.

**Acceptance evidence:** dated written legal opinion and compliance obligations register, with named owners and decisions for every release stage.

### PR-3: Non-custodial key ownership and recovery — BLOCKED

- Choose the key model and supported recovery model before implementing wallet creation. Explain clearly that loss of a self-custodied key may permanently lose access if no approved recovery method exists.
- Generate and use signing keys on the user's device or approved signing hardware. Do not send private keys, seed phrases, or signing secrets to BITZZA APIs, analytics, logs, crash reports, or support tools.
- Specify encrypted backup, restore, device migration, compromised-device response, and user-initiated key rotation. Do not imply that account-password reset recovers an on-chain wallet.
- Review any smart-account, social recovery, sponsored transaction, relayer, or recovery-provider design for both security and its effect on the non-custodial model.
- Validate transaction details on the signing surface: chain/network, destination, asset, amount, fees, and irreversible-action warning.

**Acceptance evidence:** threat model and key lifecycle design; verified no-secret telemetry tests; independent review of key handling and recovery; successful restore and lost-device exercises.

#### Recovery model comparison — decision pending

| Model | User experience and recovery | Main risks and constraints | Product implications |
|---|---|---|---|
| User-held recovery phrase (traditional externally owned account) | Portable between compatible wallets; user restores by entering the phrase into a trusted wallet | Loss or theft can mean irreversible loss or theft of assets; phishing, screenshots, cloud copies, and support scams are common hazards; no provider can safely reset it | Simpler on-chain model, but onboarding must teach secure offline backup and verify the backup without exposing the phrase |
| Hardware wallet | Signing keys remain on a dedicated device; transaction confirmation can be isolated from a compromised computer | Device availability, cost, usability, physical loss/damage, and supply/compatibility constraints; recovery still typically relies on a backup phrase | Strong signing isolation for users with supported devices; does not by itself solve backup or recovery |
| Smart account with social recovery | A defined guardian threshold can restore control without a single conventional seed phrase | Guardian collusion/unavailability, social engineering, contract bugs, recovery delays, chain/gas dependence, and added deployment/upgrade risk | Requires carefully specified guardian model, recovery delays, cancellation, audits, and a clear explanation that guardians may affect control |
| Provider-assisted or MPC recovery | May offer a familiar recovery experience across devices | Provider compromise, outages, collusion, key-share handling, and unclear user understanding; depending on implementation/control, may undermine the claimed non-custodial model or add regulated-service questions | Do not select without independent cryptographic, legal, operational, and provider review |

These are design trade-offs, not a recommendation or legal classification. Account login/password reset is not wallet-key recovery. A model may be combined with another (for example, hardware signing plus a user-held backup), but combinations need their own threat model and acceptance tests. Before selecting, compare supported chains and standards, recovery after device loss, resistance to phishing and coercion, accessibility, cost, transaction-signing clarity, provider dependency, and counsel's assessment of control and responsibilities.

### PR-4: Blockchain and contract behavior — BLOCKED

- Select chain, supported networks, token standard, transaction finality policy, fee strategy, and RPC/indexing providers only after PR-1 and PR-2.
- Specify and independently review token contract invariants, supply limits, mint/burn permissions, pausing/upgrades (if any), admin-key controls, and failure behavior.
- Implement against testnet first. Test chain mismatch, nonce/fee failures, reorgs, duplicate submissions, dropped transactions, contract errors, and balance reconciliation.
- Exclude bridges and cross-chain transfers from initial production unless separately specified, legally assessed, and security-reviewed.
- Publish verifiable deployment addresses and build artifacts for each network; no client may silently switch networks or present test assets as production assets.

**Acceptance evidence:** approved architecture; reproducible deployment artifacts; testnet integration suite; independent contract audit with all critical/high findings resolved; deployment and emergency-operation drills.

### PR-5: User, merchant, and payment journeys — BLOCKED

- Specify and test wallet creation/import, receive/send, pending/confirmed/failed states, fee display, wrong-network handling, recipient checks, transaction history, export, recovery, and support escalation.
- Vouchers and merchant payments are excluded from the selected v1 scope. Reconsider them only through a separate product decision defining issuer, redemption right, expiry, inventory, settlement asset, refunds, disputes, merchant insolvency, tax/accounting, and reconciliation responsibilities.
- Never show an offline intent as a confirmed payment. Any offline UX must distinguish local intent from broadcast and finalized transaction, and must not imply reserved funds or guaranteed delivery.
- Ensure every balance and market value is clearly identified as on-chain, provider-reported, or illustrative, with source and update time where applicable.

**Acceptance evidence:** reviewed state diagrams; automated end-to-end tests for successful and failed journeys; merchant reconciliation/refund exercises where relevant; user comprehension testing for irreversible and pending states.

### PR-6: Security, privacy, and resilience — BLOCKED

- Complete a threat model covering web/mobile clients, API, signing, smart contracts, third-party RPC/indexer/provider, admin operations, supply-chain attacks, phishing, and account/device recovery.
- Define secure development, dependency review, secret management, environment separation, least privilege, release signing, vulnerability response, and independent penetration/security reviews.
- Define personal-data inventory, lawful basis, minimization, retention/deletion, access controls, incident handling, and data-subject workflows with privacy counsel.
- Operate tested monitoring, alerting, backup/restore where applicable, incident response, service recovery objectives, and customer communications. Backups must not create undisclosed custody of user keys.
- Review access control, rate limits, abuse prevention, API validation, logging redaction, and production configuration separately from the demo implementation.

**Acceptance evidence:** approved threat model and privacy assessment; independent security reports with critical/high findings resolved; restore and incident exercises; production configuration review; named on-call and incident owners.

### PR-7: Compliance and operations — BLOCKED

- Translate counsel's assessment into operational obligations, role assignments, recordkeeping, customer/merchant onboarding, sanctions/AML controls if applicable, complaints, and escalation procedures.
- Contract and assess all providers, including wallet infrastructure, RPC/indexing, analytics, distribution, exchange, fiat conversion, payments, and merchant services.
- Define operational ownership for token/admin keys, release authority, emergency pause decisions, conflicts of interest, and key compromise.
- Provide customer support playbooks for lost keys, wrong-chain transfers, delayed/failed transactions, suspected fraud, refunds, complaints, and merchant disputes.

**Acceptance evidence:** approved responsibility matrix, provider due diligence and contracts, operating procedures, support exercises, and documented go/no-go authority.

## Verification matrix before each release

| Check | Demo | Testnet | Pilot / public production |
|---|---|---|---|
| Correctly labels simulated/test/real assets | Required | Required | Required |
| No false claim of settlement, redemption, or guaranteed value | Required | Required | Required |
| Automated unit, API, and end-to-end tests | Required | Required | Required |
| Private-key lifecycle and recovery validated | Not applicable; no keys | Required before signing tests | Independent review and recovery drills |
| Smart-contract independent review | Not applicable | Required before pilot decision | Required; critical/high findings closed |
| Written legal and compliance sign-off | Demo boundary only | Before user pilot or public distribution | Required before launch and each material feature change |
| Incident, support, and operations exercises | Basic demo support | Required before controlled pilot | Required and staffed |
| No real funds on unapproved environments | Required | Required | Required |

## Current blockers and next decisions

1. **BLOCKED:** Counsel must assess token classification and the service perimeter for the actual proposed product. Use [the legal and product briefing](./LEGAL-PRODUCT-BRIEF.md); no legal conclusion has been obtained.
2. **BLOCKED:** Decide BITZ rights, supply, issuer, distribution, and relationship to pizza vouchers and merchant settlement.
3. **BLOCKED:** Decide the v1 feature boundary and responsible legal entities/providers for each included flow.
4. **BLOCKED:** Decide key generation and recovery model before implementing non-custodial signing.
5. **BLOCKED:** Select chain and contract architecture after the product/legal decisions.
6. **NOT IMPLEMENTED:** Production wallet, blockchain connectivity, contracts, real token, real payment/merchant settlement, production key recovery, and production operations.

Until these blockers have owners and documented evidence, the safe next software milestone is a clearly isolated **testnet prototype using test assets only**, after requirements are agreed. Do not add mainnet endpoints, accept real funds, or create a production token in the current demo.
