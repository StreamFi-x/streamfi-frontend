# Dispute Resolution System for On-Chain Tips

## Overview

The dispute resolution system provides a platform-mediated mechanism to handle contested tip transactions on Stellar. Since on-chain transactions are irreversible by design, disputes are resolved through compensating payments funded by the platform, with the original transaction hash linked to all resolution activities for complete audit trails.

## Architecture

### Core Tables

#### `tip_disputes`
Central dispute ticket system. Records initiated by viewers or creators against a specific tip transaction.

- **Status Workflow**: `open` → `under_review` → `evidence_requested` → `resolved|dismissed|appealed`
- **plaintiff_type**: Distinguishes viewer (sender) from creator (recipient) disputes
- **resolution_type**: How the dispute was resolved:
  - `compensating_payment`: Platform issued funds to plaintiff
  - `creator_refund`: Creator voluntarily returned funds
  - `both_parties_agree`: Mutual settlement
  - `platform_absorbs`: Platform accepted the loss

#### `dispute_evidence`
Evidence attachment system. Supports documentation from either party.

- **evidence_type**: screenshot, email_correspondence, transaction_history, account_statement, identity_verification, chat_log, other_documentation
- **file_hash**: SHA-256 for integrity verification
- **file_url**: Reference to uploaded file (cloud storage implementation-dependent)

#### `dispute_comments`
Communication log between plaintiff, defendant, and admin. Supports internal notes visible only to admins.

- **is_visible_to_both_parties**: Controls visibility (internal notes if FALSE)

#### `dispute_appeals`
Appeal process for disputed resolutions. If accepted, creates a new dispute.

- Appellant must be one of the original parties
- Each appeal is reviewed independently

#### `dispute_metrics`
Abuse resistance tracking per user.

- **disputes_filed_lifetime/30d**: Counters for rate limiting
- **disputes_won/lost_lifetime/30d**: Outcome tracking
- **is_flagged_for_abuse**: Manual or automated flag (e.g., >80% loss rate)

### Abuse Resistance Measures

1. **Rate Limiting**
   - Maximum 3 disputes filed in 24 hours
   - Maximum 10 disputes filed in 7 days
   - Enforced via `is_dispute_rate_limited()` function

2. **Pattern Detection**
   - Detects multiple disputes against same creator (>5 in 30d)
   - Flags accounts with excessive dispute loss (>80% loss + >5 total disputes)

3. **Metrics Tracking**
   - Win/loss ratio tracked per user
   - Lifetime and rolling 30-day counters
   - Abuse flags prevent further disputes without admin review

## API Endpoints

### Filing a Dispute

**POST /api/routes-f/tip-dispute-file**

```json
{
  "tx_hash": "abc123def456...",
  "reason": "unauthorized_transaction",
  "description": "I did not authorize this payment",
  "plaintiff_type": "viewer"
}
```

**Response (201)**
```json
{
  "dispute_id": "uuid",
  "tx_hash": "abc123...",
  "status": "open",
  "created_at": "2026-10-17T10:30:00Z",
  "message": "Dispute filed successfully. Our team will review it within 48 hours."
}
```

**Validation**
- User must be the sender (if viewer) or recipient (if creator) of the original tip
- Transaction must exist on-chain
- Rate limiting applied
- No duplicate active dispute for same tx_hash
- Abuse pattern detection flags suspicious patterns

### Adding Evidence

**POST /api/routes-f/tip-dispute-evidence**

Multipart form-data:
```
dispute_id: uuid
evidence_type: "screenshot" | "email_correspondence" | ... | "other_documentation"
description: (optional)
file: (binary file, max 10MB)
```

**Response (201)**
```json
{
  "evidence_id": "uuid",
  "dispute_id": "uuid",
  "evidence_type": "screenshot",
  "file_url": "/api/evidence/hash/timestamp",
  "created_at": "2026-10-17T10:35:00Z",
  "message": "Evidence uploaded successfully."
}
```

### Admin: Resolve Dispute

**POST /api/routes-f/tip-dispute-resolve**

```json
{
  "dispute_id": "uuid",
  "resolution_type": "compensating_payment",
  "compensating_amount": "50.00",
  "compensating_tx_hash": "xyz789abc123...",
  "resolution_notes": "Transaction was unauthorized. Compensating payment issued."
}
```

**Response (200)**
```json
{
  "dispute_id": "uuid",
  "status": "resolved",
  "resolution_type": "compensating_payment",
  "resolved_at": "2026-10-17T12:00:00Z",
  "message": "Dispute resolved with compensating_payment."
}
```

**Admin Authorization**
- Only users in `admin_users` table can resolve disputes
- All resolutions are logged with admin_id for audit trail

### List Disputes

**GET /api/routes-f/tip-dispute-list**

Query parameters:
- `status`: Filter by status (optional)
- `role=admin`: Show all disputes (admin-only)
- `page`: Pagination (default 1)
- `limit`: Results per page (default 20, max 100)

**Response (200) - Regular User**
```json
{
  "disputes": [
    {
      "id": "uuid",
      "tx_hash": "abc123...",
      "plaintiff_type": "viewer",
      "reason": "unauthorized_transaction",
      "amount_disputed": "50.00",
      "asset_disputed": "XLM",
      "status": "resolved",
      "resolution_type": "compensating_payment",
      "created_at": "2026-10-17T10:30:00Z",
      "resolved_at": "2026-10-17T12:00:00Z"
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 20
}
```

## Dispute Reasons

- **unauthorized_transaction**: User claims they did not authorize the payment
- **account_compromise**: User's account was compromised/hacked
- **coercion**: Payment made under duress
- **minor_access**: Minor unauthorized access to parent's wallet
- **fraudulent_payment_method**: Original funding source was fraudulent
- **service_not_rendered**: Creator did not fulfill promised service
- **other**: Custom reason (must be detailed in description)

## Resolution Policy

### Evidentiary Standards

**Plaintiff (Viewer) Must Prove:**
- Transaction was not authorized (requires proof: screenshot, email, etc.)
- Account compromise evidence (failed login attempt logs, password change records, etc.)
- Coercion or duress (communication records, witness statements, etc.)
- Minor access (proof of age, parental statement, etc.)

**Defendant (Creator) Can Contest With:**
- Proof of viewer authorization (communication records, prior relationship history)
- Viewer's history of legitimate transactions
- Metadata showing transaction legitimacy (viewer IP consistency, normal patterns)

**Default Outcome:**
- If insufficient evidence after 7 days → dismiss
- If both parties agree → both_parties_agree resolution
- If evidence clearly supports plaintiff → compensating_payment
- If evidence clearly supports defendant → dismissed

### Compensating Payment Mechanism

Since original transactions cannot be reversed:

1. **Immediate Compensation**: Platform issues XLM/USDC payment to plaintiff upon resolution
2. **Funding Source**: Platform revenue reserve / escrow fund
3. **Creator Accountability**:
   - If resolution ruled against creator: Offset against next payout
   - If pattern emerges (>3 disputes lost): Creator account flagged for review
   - Severe cases: Creator payout suspension pending investigation

### Appeal Process

Either party can appeal a resolution:
1. Appeal filed within 14 days of resolution
2. Admin reviews appeal independently
3. If accepted: new dispute opened with escalation flag
4. If denied: original resolution stands

## Rate Limiting & Abuse Prevention

### Automated Limits

- **3 disputes per 24 hours** per user
- **10 disputes per 7 days** per user
- System returns 429 (Too Many Requests) when limit exceeded

### Pattern Detection

```sql
-- Multiple disputes against same creator
SELECT has_abuse_pattern_against_creator(plaintiff_id, recipient_id);
-- Returns TRUE if >5 disputes in 30 days

-- High dispute loss rate
-- If disputes_lost / total_disputes > 0.8 AND total > 5 → flag for abuse
```

### Admin Actions on Abuse Pattern

- Manual review of user's dispute history
- Suspend further dispute filing
- Restrict compensating payment eligibility
- Escalate for moderation review if warranted

## Audit Trail

Every dispute maintains a complete audit trail:

```
tip_disputes.tx_hash → Original Stellar transaction hash
tip_disputes.plaintiff_id → Who filed
tip_disputes.created_at → When filed
tip_disputes.resolved_by → Which admin resolved
tip_disputes.resolved_at → When resolved
tip_disputes.resolution_notes → Why decided that way
tip_disputes.compensating_tx_hash → New transaction if compensation issued
dispute_comments → Communication history
dispute_evidence → All supporting docs
```

**Immutable Fields:**
- tx_hash, plaintiff_id, created_at never change
- Deleted disputes soft-deleted (deleted_at timestamp)
- All updates recorded in updated_at

## Integration with Other Systems

### Trust Score Impact

Disputes affect `trust_score_engine.ts`:
```typescript
score -= profile.disputedTipsCount * 10;
```

High dispute loss rate → lower creator trust score → reduced visibility in recommendations.

### GDPR Compliance

Active disputes prevent account erasure:
```
gdpr-compliance.ts: erasure status = 'hold_active_dispute'
```

Financial records retained for dispute resolution and tax accounting.

### Payout Integration

Disputes integrate with payout system:
- Resolved disputes reduce pending payout (creator accountability)
- Compensating payments tracked separately from tips
- Tax reporting separates disputed vs. legitimate income

## Implementation Notes

### File Storage

Current implementation uses URL reference. For production:
- Upload to S3/GCS with signed URLs
- Implement virus scanning for uploaded files
- Set expiration on URLs (e.g., 30 days after resolution)
- Archive resolved disputes to cold storage

### Performance

- Indexes on `plaintiff_id`, `status`, `tx_hash`, `created_at`
- Rate limit check uses function (efficient, single lookup)
- Pagination required for large result sets

### Future Enhancements

1. **Dispute Arbitration**: Multi-round evidence submission (currently one round)
2. **Automated Refunds**: Integrate with compensating payment system
3. **Machine Learning**: Pattern detection for fraud rings
4. **Tiered Review**: Auto-approve obvious cases, escalate ambiguous ones
5. **Multi-Language**: Support localized dispute reasons and decisions
