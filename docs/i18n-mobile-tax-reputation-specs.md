# Architecture & Specifications: i18n, Mobile Broadcasting, Tax Export, and Trust Scores

Issues: #1427, #1430, #1431, #1439

## 1. Internationalization (i18n) Framework (#1439)
- **Architecture**: Lightweight translation engine supporting nested keys, variable interpolation (`{{var}}`), pluralization rules, and automatic English fallbacks.
- **Proof-of-Concept**: Complete Spanish (`es`) translation dictionary for common strings, tipping, streaming, and error feedback.

## 2. Mobile Livestream Broadcasting (#1431)
- **Camera Ingest**: Integrates with `navigator.mediaDevices.getUserMedia` using dynamic aspect ratios and bitrate scaling for mobile Safari and Chrome.
- **Resilience**: State coordinator managing orientation shifts, tab suspension (`visibilitychange`), and automated cellular reconnection.

## 3. Creator Tax Payout Reporting (#1427)
- **Methodology**: Historical fair market value conversion of XLM at the time of tip/subscription receipt.
- **Accounting Reconciliation**: Deducts platform processing fees and disputed transactions to produce downloadable CSV reports for IRS/Schedule C reporting.

## 4. Platform-Wide Trust & Reputation Signals (#1430)
- **Scoring Dimensions**: Evaluates account age (+20), successful transaction completion (+15), and KYC verification (+15) against penalties for moderation strikes (-15/strike) and disputes (-10/dispute).
- **Tipping UI Integration**: Displays clear trust badges (`New Creator`, `Established Streamer`, `Community Verified`, `Under Review`) before irreversible Stellar transactions are confirmed.
