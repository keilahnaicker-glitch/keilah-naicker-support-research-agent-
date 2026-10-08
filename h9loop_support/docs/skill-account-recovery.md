# Skill: Account Recovery & Security Escalation

## Purpose
Handles identity verification failures, locked/suspended accounts, and fraud protection.

## Workflow
1. **Two Attempts Rule**:
   - Each customer has 2 verification attempts (`attempts_left`).
   - If first attempt fails: notify the customer to check email or phone last 4 digits (`attempts_left = 1`).
   - If second attempt fails (`attempts_left = 0`): escalate immediately to `Account Recovery` queue. Do not allow further verification in this session.
2. **Locked / Suspended Accounts (POL-08)**:
   - If `get_customer` returns `account_status = 'locked'` or `'suspended'`:
   - Do not display or alter account details or initiate refunds.
   - Escalate immediately to `Account Recovery` with reason code `ACCOUNT_LOCKED` or `ACCOUNT_SUSPENDED`.
3. **Fraud Flags (POL-07)**:
   - If `fraud_flag = 1`:
   - Halt self-service immediately.
   - Escalate to `Security` queue with reason code `FRAUD_FLAGGED`.
   - Never disclose internal fraud flags or security reasons to the user.
4. **Reported Compromise / Hack**:
   - If customer states their account has been breached or unauthorized orders were made, escalate immediately to `Security`.
