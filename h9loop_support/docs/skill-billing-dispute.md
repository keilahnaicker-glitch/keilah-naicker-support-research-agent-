# Skill: Billing Disputes & Duplicate Charges

## Purpose
Governs duplicate charges, subscription renewal cancellations, and payment anomalies.

## Workflow
1. **Duplicate Charges (POL-09)**:
   - Requires verification via `verify_identity`.
   - Inspect payments via `lookup_order(order_number)`.
   - Must have exactly two settled payments (`status = 'settled'`) linked to that order.
   - If confirmed, `check_refund_eligibility(order_number, 'duplicate_charge')` will return `eligible=true` for the single duplicate charge amount.
   - After explicit customer consent, issue refund with `refund_type = 'duplicate_charge'` and idempotency key `${order_number}:duplicate_charge`.
   - If payments data is conflicting (e.g., mismatched amounts, 3+ charges, unconfirmed status), escalate to Billing queue.
2. **Subscription Renewals (POL-06)**:
   - For recurring subscriptions (e.g. P004 Claude Skills Jar), renewal reversals are only permitted within 14 days of charge date.
   - Beyond 14 days, renewals cannot be reversed. Politely decline and explain cancellation will apply to future cycles.
3. **Unrecognised Charges**:
   - Verify identity.
   - If customer reports unauthorized access or card compromise, immediately escalate to Security queue (G5).
