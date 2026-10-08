# Skill: Refund Eligibility & Execution Gatekeeper

## Purpose
Enforces code-side and model-side gates before any monetary transaction is inspected or submitted.

## Workflow
1. **Verification Gate**:
   - Customer must be verified first via `verify_identity(customer_id, email, phone_last4)`.
   - If `verified=false`, do not confirm account presence or inspect orders.
2. **Order Ownership**:
   - Order customer ID must match verified customer ID.
3. **Product & Order Status Gate**:
   - Non-refundable product (`refundable = 0`, e.g. P009 Prompt Pack): Ineligible (POL-02).
   - Order age > 14 days from `order_date` relative to reference date (2026-10-05): Ineligible (POL-01).
   - Order already refunded (`refund_status = 'refunded'`): Ineligible (POL-03).
   - Account status `locked` or `suspended`: Escalate to Account Recovery (POL-08).
   - Customer `fraud_flag = 1`: Escalate to Security (POL-07).
4. **Amount Limits**:
   - ≤ R5,000.00: Can be approved autonomously by the agent AFTER explicit customer confirmation ("yes").
   - > R5,000.00 and ≤ R10,000.00: Requires Human Approval (POL-04). Escalate to `Refund Approvals` queue.
   - > R10,000.00: Hard escalation limit (POL-05). Agent must NEVER process. Escalate to `Refund Approvals` / Finance.
5. **Partial Refunds**:
   - Agent cannot process partial refunds (POL-13). Escalate to Billing queue with amount requested.
6. **Execution**:
   - Only execute `process_refund` when `check_refund_eligibility` returns `eligible=true` AND customer explicitly provided affirmative consent ("yes").
   - Idempotency key must be `order_number + ':' + refund_type`.
   - Never issue duplicate refunds.
