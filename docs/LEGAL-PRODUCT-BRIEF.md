# BITZZA legal and product briefing for counsel

## Purpose and status

This is a working brief to help qualified counsel assess a possible Italy/EU launch. It records the current product direction and known gaps; it is not legal advice, a legal classification, an offer document, or permission to issue or trade a token. Counsel should verify current law, national implementation, supervisory practice, and the facts of the final product before any public communication or real-money activity.

## Product direction selected so far

- **Initial market:** Italy and the EU.
- **Wallet model:** non-custodial; users are intended to control their own transaction-signing keys.
- **Token direction:** BITZ is intended to be transferable and exchangeable, with a market value.
- **Proposed v1 app scope:** create or import a wallet, receive BITZ, and send BITZ. No in-app purchase/sale or exchange, pizza vouchers, or merchant payments in v1.
- **Future product context:** pizzerias and pizza vouchers remain part of the broader vision. Their connection to BITZ, including any redemption, payment, discount, or settlement rights, has not been decided and is outside v1.
- **Chain, issuer, token supply, distribution, and market access:** not selected.

These points are product intentions only. The final rights attached to a token and the actual functions performed by BITZZA, the issuer, merchants, and service providers determine the legal analysis. Calling a wallet “non-custodial” or a token a “utility token” is not, on its own, a classification or exemption.

## Current implementation boundary

The repository contains a demo web wallet and simulated server-side ledger. Demo balances, BITZ, market values, mining rewards, vouchers, and merchant settlement are not blockchain assets or claims on real funds. The demo has no signing keys, smart contracts, real merchant settlement, exchange, fiat on/off-ramp, identity verification, or production key recovery. Do not transfer demo balances or voucher records into a future production system.

## Questions for counsel

### Token classification and issuance

1. Based on the proposed rights, marketing, supply, transferability, price behavior, and any connection to pizza or merchant settlement, what regimes could apply (including MiCA categories, financial-instrument rules, or electronic-money/payment rules)?
2. Who would be the issuer and offeror, and which entity and jurisdiction should be used?
3. What white paper, notification, publication, admission-to-trading, ongoing disclosure, or marketing requirements apply? Which exemptions, if any, are available and appropriate for the intended launch?
4. Which statements about value, utility, redemption, rewards, scarcity, appreciation, or merchant acceptance would be restricted or require substantiation?
5. What obligations apply to token distribution, including sales, airdrops, rewards currently called “mining,” founder/team allocations, and any public or private placement?

### Wallet, services, and market access

6. For the proposed v1 wallet flows (creation/import, receiving, and user-signed sending), does BITZZA or any provider perform a regulated crypto-asset service or another regulated activity? Separately identify the additional analysis needed before adding exchange, routing, order matching, token placement, transfer facilitation, or third-party trading integrations.
7. What authorization, registration, governance, capital, safeguarding, outsourcing, complaint-handling, and operational requirements apply to BITZZA and each provider?
8. Is direct peer-to-peer token transfer in scope of any transfer-information, sanctions, or other controls? Which parties are responsible when a transaction is user-signed and broadcast by a service?
9. Can a non-custodial design include account recovery, sponsored gas, smart accounts, or transaction relaying without changing the regulatory analysis?
10. What controls and disclosures are required before enabling exchange access or linking a third-party trading venue?

### Pizzerias, vouchers, and consumer flows

11. How should pizza vouchers be structured and described so their rights, expiry, refunds, merchant obligations, and settlement are clear? Could any proposed voucher or BITZ redemption promise trigger e-money, payment-services, consumer-credit, or other rules?
12. What payment, acquiring, safeguarding, settlement, tax/VAT, invoicing, refund, chargeback, and reconciliation arrangements are required for merchants?
13. What customer and merchant terms, risk warnings, complaint channels, accessibility, and consumer-protection measures are needed?
14. Which food, allergen, nutrition, provenance, and advertising statements require verification, and who is responsible for keeping them current?

### Compliance, privacy, and launch controls

15. Which AML/CFT, customer due-diligence, sanctions, suspicious-activity, recordkeeping, and transfer-information obligations apply to the issuer, wallet, venues, and partners?
16. What personal-data roles, lawful bases, retention periods, data-subject processes, and cross-border processing safeguards are required under GDPR?
17. Which EU/EEA countries may be served initially, and what steps are needed before expanding beyond them?
18. What written legal, compliance, security, and operational sign-offs must be obtained before a testnet pilot, public offer, exchange access, or mainnet launch?

## Product decisions to resolve before implementation

- Token rights, supply and issuance controls, distribution schedule, and whether BITZ has any redemption or merchant-payment role.
- Issuer entity, governance model, admin-key authority, and incident/pause procedures.
- Initial chain and supported networks; whether any bridge or cross-chain functionality is expressly excluded from the first release.
- Wallet onboarding, key backup and recovery, transaction signing, fee payment, lost-device support, and user disclosures.
- The proposed first release is limited to wallet creation/import, receiving, and sending BITZ; confirm whether any other capability is required before implementation.
- Whether any future release includes buying, selling, exchange access, merchant acceptance, vouchers, or rewards, each of which needs separate product and legal assessment.
- Merchant settlement and customer refund model, including the asset and party responsible for each flow.
- Any third-party providers for distribution, exchange, fiat conversion, compliance, custody of issuer/admin keys, or merchant payment processing.

These decisions must not be inferred from the existing simulated demo. For each proposed feature, document the user flow, responsible legal entity, asset movement, data processed, third-party role, and applicable counsel conclusion.

## Suggested counsel deliverables

Request a written, product-specific assessment that:

1. maps each user and merchant flow to the responsible entities and services;
2. classifies the proposed token and vouchers against applicable EU and Italian regimes;
3. lists authorizations, registrations, disclosures, policies, contracts, controls, and external partners required for each launch stage;
4. identifies prohibited or high-risk product claims and features;
5. defines legal release gates for a testnet pilot, any public distribution, exchange access, and mainnet use; and
6. records assumptions, open questions, and the date and sources used so the assessment can be refreshed when the design or rules change.

## Reference material for review

- [Regulation (EU) 2023/1114 on markets in crypto-assets (MiCA)](https://eur-lex.europa.eu/eli/reg/2023/1114/oj)
- [ESMA MiCA information and register](https://www.esma.europa.eu/esmas-activities/digital-finance-and-innovation/markets-crypto-assets-regulation-mica)

Counsel should confirm whether these materials have been amended, supplemented, or affected by applicable Italian measures and current supervisory guidance.
