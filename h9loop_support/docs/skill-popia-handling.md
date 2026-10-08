# Skill: POPIA (Protection of Personal Information Act) Compliance

## Purpose
Ensures zero data leakage, proper redaction, strict customer boundary isolation, and audit trail sanitization.

## Core Rules
1. **Masking & Display**:
   - Phone numbers must only ever be displayed with their last 4 digits (e.g. `ending in 7500`).
   - Never display full South African ID numbers, card numbers, or passwords.
   - Do not request passwords or credit card numbers in chat.
2. **Account Isolation**:
   - Before `verify_identity` succeeds with `verified = true`, never confirm or deny that an account or order exists in our system.
   - A customer cannot inspect or act on orders owned by another customer ID.
3. **Internal Data Confidentiality**:
   - Never reveal internal notes (`notes` column), fraud flag markers, risk scores, or backend SQL/database mechanisms to the customer.
4. **Audit Trail Sanitization**:
   - When logging conversation events to `/audit_trail/`, record only `customer_id` (`C1001`), never plain-text full email addresses or complete phone numbers.
   - Retain logs for audit and compliance inspection.
