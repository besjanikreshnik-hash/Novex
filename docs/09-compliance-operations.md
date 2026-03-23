# NovEx — Compliance-Aware Operational Design

## 1. Regulatory Framework Awareness

NovEx is designed to be **compliance-ready** without being tied to a specific jurisdiction. All compliance components are abstracted behind integration interfaces.

### Supported Compliance Models

| Framework       | Regions                | Key Requirements                            |
|-----------------|------------------------|---------------------------------------------|
| MiCA            | EU                     | CASP registration, reserve requirements     |
| Travel Rule     | FATF member states     | Originator/beneficiary info on transfers    |
| BSA/FinCEN      | United States          | MSB registration, SAR/CTR filing            |
| MAS PS Act      | Singapore              | DPT service license                         |
| VASP Framework  | Various                | Registration, AML/KYC requirements          |

*NovEx does not provide legal compliance — it provides the technical architecture to support compliance in any jurisdiction.*

## 2. KYC Integration Architecture

### Abstraction Layer

```typescript
// KYC Provider Interface — vendor-agnostic
interface KYCProvider {
  // Create a verification session
  createSession(userId: string, tier: KYCTier): Promise<KYCSession>;

  // Get verification status
  getStatus(sessionId: string): Promise<KYCStatus>;

  // Handle webhook callback from provider
  handleWebhook(payload: unknown): Promise<KYCWebhookResult>;
}

// Supported providers (implement interface):
// - SumsubProvider (Sumsub)
// - JumioProvider (Jumio)
// - OnfidoProvider (Onfido)
// - ManualProvider (internal review, for testing)
```

### KYC Tiers

```
Tier 0 — Unverified:
  Limits: View-only, no trading or deposits
  Requirements: Email verification only

Tier 1 — Basic:
  Limits: $10,000/day deposit, $5,000/day withdrawal
  Requirements:
    - Full legal name
    - Date of birth
    - Country of residence
    - Government-issued ID (passport, driver's license)
    - Selfie verification (liveness check)

Tier 2 — Enhanced:
  Limits: $100,000/day deposit, $50,000/day withdrawal
  Requirements:
    - All Tier 1 requirements
    - Proof of address (utility bill, bank statement < 3 months)
    - Source of funds declaration
    - Enhanced due diligence screening

Corporate:
  Limits: Custom (negotiated)
  Requirements:
    - Certificate of incorporation
    - Shareholder register
    - UBO identification (>25% ownership)
    - Director verification (Tier 1 each)
    - AML policy documentation
```

## 3. AML/Transaction Monitoring

### Transaction Screening Architecture

```
                  ┌───────────────────┐
  Transaction ──→ │ Pre-Transaction   │
                  │ Screening         │
                  │ - Sanctions check │
                  │ - Address scoring │
                  └────────┬──────────┘
                           │
                  ┌────────▼──────────┐
                  │ Post-Transaction  │
                  │ Monitoring        │
                  │ - Pattern detect  │
                  │ - Volume analysis │
                  │ - Behavior scoring│
                  └────────┬──────────┘
                           │
                  ┌────────▼──────────┐
                  │ Alert Generation  │
                  │ - Risk scoring    │
                  │ - Auto-freeze     │
                  │ - SAR preparation │
                  └───────────────────┘
```

### Risk Scoring Factors

```
Transaction Risk:
  - Amount relative to user's history (zscore > 3 = flag)
  - Counterparty address risk (chain analysis integration placeholder)
  - Time pattern (off-hours for user's timezone)
  - Multiple small transactions (structuring detection)
  - Round amounts (common in laundering)

User Risk:
  - KYC tier (lower = higher risk)
  - Account age (newer = higher risk)
  - Country of residence (FATF grey/black list)
  - Verification failures
  - Previous alerts

Combined Score: 0.0 (safe) → 1.0 (block)
  < 0.3: Auto-approve
  0.3–0.6: Enhanced monitoring
  0.6–0.8: Manual review required
  > 0.8: Auto-block, notify compliance
```

### Chain Analysis Integration (Placeholder)

```typescript
interface ChainAnalysisProvider {
  // Score a wallet address for risk
  scoreAddress(address: string, chain: string): Promise<AddressRisk>;

  // Check if address is sanctioned
  isSanctioned(address: string, chain: string): Promise<boolean>;

  // Get address cluster information
  getCluster(address: string, chain: string): Promise<ClusterInfo>;
}

// Implementations:
// - ChainalysisProvider (Chainalysis KYT)
// - EllipticProvider (Elliptic)
// - MockProvider (development/testing)
```

## 4. Travel Rule Compliance

```
When: Transfers > $1,000 USD equivalent (FATF threshold)

Outgoing Transfer:
  1. Collect originator info (name, account, address)
  2. Collect beneficiary info (name, destination address)
  3. Transmit via Travel Rule protocol to counterparty VASP
  4. Store proof of transmission

Incoming Transfer:
  1. Receive originator info from counterparty VASP
  2. Screen against sanctions lists
  3. Store received information
  4. Credit funds after screening

Integration Placeholder:
  - Notabene, Sygna Bridge, or OpenVASP protocol
  - Abstract behind TravelRuleProvider interface
```

## 5. Geo-Restrictions

```
Platform-Level Blocking:
  - Sanctioned countries: Blocked at IP level (WAF rules)
  - Restricted countries: Registration blocked, existing users grandfathered with review
  - IP detection: MaxMind GeoIP2 database
  - VPN detection: Integration placeholder for VPN/proxy detection service

Per-Feature Restrictions:
  - Some features may be restricted per jurisdiction
  - Configured via system_config table
  - Enforced at API middleware level

User-Facing:
  - Clear messaging about geographic restrictions
  - No specific legal advice provided
  - Link to terms of service
```

## 6. Data Privacy

### GDPR / Privacy Compliance

```
User Rights Support:
  - Right to Access: Export all user data (profile, trades, balances)
  - Right to Erasure: Anonymize user data (preserve trade records per financial regulations)
  - Right to Portability: Export in machine-readable format (JSON/CSV)
  - Right to Rectification: Edit profile data

Implementation:
  - Data export API endpoint (admin-triggered, queued)
  - Anonymization script (replace PII with hashes, keep financial records)
  - Consent tracking (what user agreed to, when)
  - Data retention policies per data type

Retention Schedule:
  - User profile: Until account deletion + 30 days
  - KYC documents: 5 years after account closure (regulatory)
  - Trade records: 7 years (financial regulatory)
  - Audit logs: 7 years
  - Login history: 2 years
  - Support tickets: 3 years after resolution
```

## 7. Operational Procedures

### Suspicious Activity Workflow

```
1. Alert generated (automated or manual)
2. Compliance analyst reviews in admin panel
3. Decision:
   a. False positive → Close alert, update rules
   b. Suspicious → Freeze account, gather evidence
   c. Confirmed → File SAR (jurisdiction-dependent), maintain freeze
4. All decisions logged in audit trail
5. Periodic review of frozen accounts
```

### Account Freeze/Unfreeze

```
Freeze Triggers:
  - Compliance team manual action
  - Automated risk score > 0.8
  - Law enforcement request (with proper documentation)
  - User self-freeze (security concern)

Freeze Effects:
  - Trading: Disabled
  - Withdrawals: Disabled
  - Deposits: Continue receiving (to not lose funds)
  - Login: Allowed (to view balance, contact support)
  - API: Disabled

Unfreeze:
  - Compliance approval required
  - Documented reason
  - Audit logged
```

## 8. Reporting

### Automated Reports

```
Daily:
  - New registrations by country
  - Large transactions (> $10K)
  - Flagged transactions summary
  - Hot wallet balances

Weekly:
  - KYC completion rates
  - Transaction volume by asset
  - Risk alert summary
  - Account freeze/unfreeze activity

Monthly:
  - Compliance metrics dashboard
  - SAR filing summary (if applicable)
  - User growth and geography breakdown
  - Fee revenue breakdown
```
