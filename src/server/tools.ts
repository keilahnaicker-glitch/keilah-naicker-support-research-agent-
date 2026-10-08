/**
 * The Six Canonical Tools for H9loop Support Resolver.
 * Strict boundary enforcement, POPIA compliance, and typed error handling.
 */
import { db, CustomerRow, OrderRow, PaymentRow, RefundRow } from './db.ts';

// Reference date for date-based eligibility calculations (from dataset spec: 2026-10-05)
export const REFERENCE_DATE = new Date('2026-10-05T00:00:00Z');

export interface StructuredError {
  is_error: true;
  category: 'validation' | 'not_found' | 'permission' | 'policy' | 'timeout' | 'unavailable';
  retryable: boolean;
  retry_after_ms: number | null;
  field: string | null;
  message: string;
}

export function createError(
  category: StructuredError['category'],
  message: string,
  field: string | null = null,
  retryable: boolean = false,
  retry_after_ms: number | null = null
): StructuredError {
  return {
    is_error: true,
    category,
    retryable,
    retry_after_ms,
    field,
    message
  };
}

// 1. verify_identity(customer_id, email, phone_last4)
// Returns ONLY verified and attempts_left. Never returns account data.
export interface VerifyIdentityResult {
  verified: boolean;
  attempts_left: number;
  message: string;
}

export function verifyIdentity(
  customerId: string,
  email: string,
  phoneLast4: string
): VerifyIdentityResult | StructuredError {
  // Field validations
  if (!customerId || !customerId.trim()) {
    return createError('validation', 'Customer ID is required.', 'customer_id', true);
  }
  if (!email || !email.trim()) {
    return createError('validation', 'Email is required for identity verification.', 'email', true);
  }
  if (!phoneLast4 || !phoneLast4.trim()) {
    return createError('validation', 'Last 4 digits of phone number are required.', 'phone_last4', true);
  }

  const cleanCustId = customerId.trim().toUpperCase();
  const cleanEmail = email.trim().toLowerCase();
  const cleanPhoneLast4 = phoneLast4.trim().replace(/\D/g, '');

  if (cleanPhoneLast4.length !== 4) {
    return createError('validation', 'Phone last 4 digits must contain exactly 4 numeric digits.', 'phone_last4', true);
  }

  const customers = db.getCustomers();
  const cust = customers.find(c => c.customer_id.toUpperCase() === cleanCustId);

  const verificationState = db.getCustomerVerification(cleanCustId);

  if (verificationState.attemptsLeft <= 0) {
    return createError(
      'permission',
      'Maximum verification attempts exceeded (2 failed attempts). Escalate to Account Recovery queue.',
      'customer_id',
      false
    );
  }

  // To comply with G1: Before verified=true, do not confirm that an account exists!
  // If customer not found, treat as mismatch attempt
  if (!cust) {
    const remaining = verificationState.attemptsLeft - 1;
    db.setCustomerVerification(cleanCustId, false, remaining);
    db.logAudit({
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      customer_id: cleanCustId,
      order_number: null,
      action_type: 'IDENTITY_CHECK',
      redacted_summary: `Identity verification failed (Customer not found). Attempts left: ${remaining}`
    });
    return {
      verified: false,
      attempts_left: remaining,
      message: `Verification details could not be matched. Attempts left: ${remaining}.`
    };
  }

  const custEmail = cust.email.trim().toLowerCase();
  const custPhoneLast4 = (cust.verification_phone_last4 || cust.phone.slice(-4)).trim();

  if (cleanEmail === custEmail && cleanPhoneLast4 === custPhoneLast4) {
    db.setCustomerVerification(cleanCustId, true, verificationState.attemptsLeft);
    db.logAudit({
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      customer_id: cleanCustId,
      order_number: null,
      action_type: 'IDENTITY_CHECK',
      redacted_summary: 'Identity verification succeeded.'
    });
    return {
      verified: true,
      attempts_left: verificationState.attemptsLeft,
      message: 'Identity verified successfully.'
    };
  } else {
    const remaining = verificationState.attemptsLeft - 1;
    db.setCustomerVerification(cleanCustId, false, remaining);
    db.logAudit({
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      customer_id: cleanCustId,
      order_number: null,
      action_type: 'IDENTITY_CHECK',
      redacted_summary: `Identity verification failed (Credential mismatch). Attempts left: ${remaining}`
    });
    return {
      verified: false,
      attempts_left: remaining,
      message: `Verification details do not match records. Attempts left: ${remaining}.`
    };
  }
}

// 2. get_customer(customer_id)
// Read customer metadata after verification. Does NOT return orders.
export interface CustomerMetadata {
  customer_id: string;
  full_name: string;
  email: string;
  phone_masked: string;
  city: string;
  province: string;
  client_type: string;
  company: string;
  membership_status: string;
  account_status: string;
  fraud_flag: boolean;
  joined_date: string;
  open_cases: number;
}

export function getCustomer(customerId: string): CustomerMetadata | StructuredError {
  if (!customerId || !customerId.trim()) {
    return createError('validation', 'Customer ID is required.', 'customer_id', true);
  }

  const cleanCustId = customerId.trim().toUpperCase();
  const verification = db.getCustomerVerification(cleanCustId);

  if (!verification.verified) {
    return createError('permission', 'Customer identity must be verified before account details can be accessed.', 'customer_id', false);
  }

  const customers = db.getCustomers();
  const cust = customers.find(c => c.customer_id.toUpperCase() === cleanCustId);

  if (!cust) {
    return createError('not_found', 'Customer record not found.', 'customer_id', false);
  }

  // POPIA Masking: only show last 4 digits
  const last4 = cust.verification_phone_last4 || cust.phone.slice(-4);
  const phoneMasked = `...ending in ${last4}`;

  return {
    customer_id: cust.customer_id,
    full_name: cust.full_name,
    email: cust.email,
    phone_masked: phoneMasked,
    city: cust.city,
    province: cust.province,
    client_type: cust.client_type,
    company: cust.company,
    membership_status: cust.membership_status,
    account_status: cust.account_status,
    fraud_flag: cust.fraud_flag === '1',
    joined_date: cust.joined_date,
    open_cases: parseInt(cust.open_cases, 10) || 0
  };
}

// 3. lookup_order(order_number, requesting_customer_id)
// Reads the order, linked payments, existing refunds; does not decide eligibility.
export interface OrderLookupResult {
  order_number: string;
  customer_id: string;
  product_id: string;
  product_name: string;
  product_category: string;
  is_digital: boolean;
  is_subscription: boolean;
  refundable: boolean;
  order_date: string;
  amount_zar: number;
  delivery_status: string;
  delivery_date: string;
  refund_window_ends: string;
  payment_method: string;
  refund_status: string;
  payments: Array<{
    transaction_id: string;
    amount_zar: number;
    payment_date: string;
    status: string;
    method: string;
  }>;
  refunds: Array<{
    refund_id: string;
    amount_zar: number;
    created_date: string;
    status: string;
  }>;
}

export function lookupOrder(orderNumber: string, requestingCustomerId?: string): OrderLookupResult | StructuredError {
  if (!orderNumber || !orderNumber.trim()) {
    return createError('validation', 'Order number is required. Do not guess an order number.', 'order_number', true);
  }

  const cleanOrderNum = orderNumber.trim().toUpperCase();
  const orders = db.getOrders();
  const order = orders.find(o => o.order_number.toUpperCase() === cleanOrderNum);

  if (!order) {
    return createError('not_found', `Order ${cleanOrderNum} was not found. Please verify the order number.`, 'order_number', false);
  }

  // Enforce customer verification & ownership
  if (requestingCustomerId) {
    const cleanCustId = requestingCustomerId.trim().toUpperCase();
    const verification = db.getCustomerVerification(cleanCustId);
    if (!verification.verified) {
      return createError('permission', 'Customer identity must be verified before inspecting orders.', 'customer_id', false);
    }
    if (order.customer_id.toUpperCase() !== cleanCustId) {
      // POPIA rule: do not disclose another customer's data
      return createError('permission', 'This order does not belong to the verified customer.', 'order_number', false);
    }
  }

  // Linked products
  const products = db.getProducts();
  const product = products.find(p => p.product_id.toUpperCase() === order.product_id.toUpperCase());

  // Linked payments
  const payments = db.getPayments()
    .filter(p => p.order_number.toUpperCase() === cleanOrderNum)
    .map(p => ({
      transaction_id: p.transaction_id,
      amount_zar: parseFloat(p.amount_zar) || 0,
      payment_date: p.payment_date,
      status: p.status,
      method: p.method
    }));

  // Linked refunds
  const refunds = db.getRefunds()
    .filter(r => r.order_number.toUpperCase() === cleanOrderNum)
    .map(r => ({
      refund_id: r.refund_id,
      amount_zar: parseFloat(r.amount_zar) || 0,
      created_date: r.created_date,
      status: r.status
    }));

  return {
    order_number: order.order_number,
    customer_id: order.customer_id,
    product_id: order.product_id,
    product_name: product ? product.name : 'Unknown Product',
    product_category: product ? product.category : 'General',
    is_digital: product ? product.is_digital === '1' : false,
    is_subscription: product ? product.is_subscription === '1' : false,
    refundable: product ? product.refundable === '1' : true,
    order_date: order.order_date,
    amount_zar: parseFloat(order.amount_zar) || 0,
    delivery_status: order.delivery_status,
    delivery_date: order.delivery_date,
    refund_window_ends: order.refund_window_ends,
    payment_method: order.payment_method,
    refund_status: order.refund_status,
    payments,
    refunds
  };
}

// 4. check_refund_eligibility(order_number, refund_type)
// Read-only; refund_type: "order" | "duplicate_charge".
// Returns { eligible, reason_code, amount_zar, needs_human_approval, rule_ids }.
export interface RefundEligibilityResult {
  eligible: boolean;
  reason_code: string;
  amount_zar: number;
  needs_human_approval: boolean;
  rule_ids: string[];
  message: string;
}

export function checkRefundEligibility(
  orderNumber: string,
  refundType: 'order' | 'duplicate_charge' = 'order',
  requestingCustomerId?: string
): RefundEligibilityResult | StructuredError {
  if (!orderNumber || !orderNumber.trim()) {
    return createError('validation', 'Order number is required.', 'order_number', true);
  }
  if (refundType !== 'order' && refundType !== 'duplicate_charge') {
    return createError('validation', 'Refund type must be either "order" or "duplicate_charge".', 'refund_type', true);
  }

  // Lookup order
  const orderLookup = lookupOrder(orderNumber, requestingCustomerId);
  if ('is_error' in orderLookup) {
    return orderLookup;
  }

  const customerId = orderLookup.customer_id;
  const customers = db.getCustomers();
  const customer = customers.find(c => c.customer_id.toUpperCase() === customerId.toUpperCase());

  if (!customer) {
    return createError('not_found', 'Associated customer record not found.', 'customer_id', false);
  }

  // POL-07: Fraud flag check
  if (customer.fraud_flag === '1') {
    return {
      eligible: false,
      reason_code: 'FRAUD_FLAG_ESCALATE',
      amount_zar: orderLookup.amount_zar,
      needs_human_approval: true,
      rule_ids: ['POL-07', 'G5'],
      message: 'Account is flagged for security review. Must be escalated to Security queue.'
    };
  }

  // POL-08: Locked or suspended account check
  if (customer.account_status === 'locked' || customer.account_status === 'suspended') {
    return {
      eligible: false,
      reason_code: customer.account_status === 'locked' ? 'ACCOUNT_LOCKED' : 'ACCOUNT_SUSPENDED',
      amount_zar: orderLookup.amount_zar,
      needs_human_approval: true,
      rule_ids: ['POL-08', 'G5'],
      message: `Account status is ${customer.account_status}. Must be escalated to Account Recovery queue.`
    };
  }

  // POL-03: Single refund per order
  if (orderLookup.refund_status === 'refunded' || orderLookup.refunds.some(r => r.status === 'completed')) {
    return {
      eligible: false,
      reason_code: 'ALREADY_REFUNDED',
      amount_zar: orderLookup.amount_zar,
      needs_human_approval: false,
      rule_ids: ['POL-03'],
      message: 'This order has already been refunded. Only one refund per order is permitted.'
    };
  }

  // POL-02: Non-refundable product check
  if (!orderLookup.refundable) {
    return {
      eligible: false,
      reason_code: 'NON_REFUNDABLE_PRODUCT',
      amount_zar: orderLookup.amount_zar,
      needs_human_approval: false,
      rule_ids: ['POL-02'],
      message: `Product ${orderLookup.product_name} is classified as non-refundable once delivered.`
    };
  }

  // Duplicate charge scenario
  if (refundType === 'duplicate_charge') {
    const settledPayments = orderLookup.payments.filter(p => p.status === 'settled');
    if (settledPayments.length < 2) {
      return {
        eligible: false,
        reason_code: 'NO_DUPLICATE_PAYMENT_FOUND',
        amount_zar: 0,
        needs_human_approval: false,
        rule_ids: ['POL-09'],
        message: 'Duplicate charge requires at least two settled payments for this order.'
      };
    }

    const dupAmount = settledPayments[1].amount_zar;

    // Check threshold rules on dup charge amount
    if (dupAmount > 10000) {
      return {
        eligible: false,
        reason_code: 'EXCEEDS_HARD_LIMIT_ESCALATE',
        amount_zar: dupAmount,
        needs_human_approval: true,
        rule_ids: ['POL-05', 'POL-09'],
        message: 'Duplicate refund amount exceeds R10,000.00 hard limit. Must be escalated to Refund Approvals.'
      };
    }
    if (dupAmount > 5000) {
      return {
        eligible: false,
        reason_code: 'REQUIRES_HUMAN_APPROVAL',
        amount_zar: dupAmount,
        needs_human_approval: true,
        rule_ids: ['POL-04', 'POL-09'],
        message: 'Duplicate refund amount exceeds R5,000.00 and requires human approval before processing.'
      };
    }

    return {
      eligible: true,
      reason_code: 'DUPLICATE_CHARGE_VERIFIED',
      amount_zar: dupAmount,
      needs_human_approval: false,
      rule_ids: ['POL-09'],
      message: `Duplicate charge of R${dupAmount.toFixed(2)} verified for refund.`
    };
  }

  // Standard Order Refund scenario
  const orderDate = new Date(orderLookup.order_date + 'T00:00:00Z');
  const diffDays = Math.floor((REFERENCE_DATE.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));

  // POL-01 & POL-06: 14-day window
  if (diffDays > 14) {
    const isSub = orderLookup.is_subscription;
    return {
      eligible: false,
      reason_code: isSub ? 'SUBSCRIPTION_RENEWAL_WINDOW_EXPIRED' : 'REFUND_WINDOW_EXPIRED',
      amount_zar: orderLookup.amount_zar,
      needs_human_approval: false,
      rule_ids: isSub ? ['POL-06'] : ['POL-01'],
      message: `The 14-day refund window expired (${diffDays} days since order on ${orderLookup.order_date}).`
    };
  }

  // POL-05: Hard escalation limit (> R10,000.00)
  if (orderLookup.amount_zar > 10000) {
    return {
      eligible: false,
      reason_code: 'EXCEEDS_HARD_LIMIT_ESCALATE',
      amount_zar: orderLookup.amount_zar,
      needs_human_approval: true,
      rule_ids: ['POL-05', 'G5'],
      message: 'Refund amount exceeds R10,000.00 hard limit. The autonomous resolver cannot process this.'
    };
  }

  // POL-04: Refund approval limit (> R5,000.00)
  if (orderLookup.amount_zar > 5000) {
    return {
      eligible: false,
      reason_code: 'REQUIRES_HUMAN_APPROVAL',
      amount_zar: orderLookup.amount_zar,
      needs_human_approval: true,
      rule_ids: ['POL-04', 'G5'],
      message: 'Refund amount exceeds R5,000.00 and requires human approval before processing.'
    };
  }

  // Eligible!
  return {
    eligible: true,
    reason_code: 'ELIGIBLE_FOR_REFUND',
    amount_zar: orderLookup.amount_zar,
    needs_human_approval: false,
    rule_ids: ['POL-01'],
    message: `Order is eligible for a full refund of R${orderLookup.amount_zar.toFixed(2)}.`
  };
}

// 5. process_refund(order_number, refund_type, idempotency_key)
// Write only after all code-side gates; repeat same result for same key.
export interface ProcessRefundResult {
  status: 'completed';
  refund_id: string;
  order_number: string;
  amount_zar: number;
  processed_at: string;
  refund_type: string;
  message: string;
}

export function processRefund(
  orderNumber: string,
  refundType: 'order' | 'duplicate_charge' = 'order',
  idempotencyKey?: string,
  requestingCustomerId?: string
): ProcessRefundResult | StructuredError {
  if (!orderNumber || !orderNumber.trim()) {
    return createError('validation', 'Order number is required.', 'order_number', true);
  }

  const cleanOrderNum = orderNumber.trim().toUpperCase();
  const expectedKey = `${cleanOrderNum}:${refundType}`;

  // Validate idempotency key format
  const activeKey = idempotencyKey ? idempotencyKey.trim() : expectedKey;
  if (activeKey !== expectedKey) {
    return createError('validation', `Invalid idempotency key '${activeKey}'. Expected format is '${expectedKey}'.`, 'idempotency_key', true);
  }

  // Check if idempotency key was already processed
  const cached = db.getIdempotentResult(activeKey);
  if (cached) {
    return cached as ProcessRefundResult;
  }

  // Run eligibility gates
  const eligibility = checkRefundEligibility(cleanOrderNum, refundType, requestingCustomerId);
  if ('is_error' in eligibility) {
    return eligibility;
  }

  if (!eligibility.eligible) {
    return createError('policy', `Refund cannot be processed: ${eligibility.message} (Reason: ${eligibility.reason_code})`, null, false);
  }

  if (eligibility.needs_human_approval) {
    return createError('policy', 'Refund requires human approval and cannot be processed autonomously.', null, false);
  }

  // Generate refund ID
  const existingRefunds = db.getRefunds();
  const nextIdNum = 700000 + existingRefunds.length;
  const refundId = `RF${nextIdNum}`;
  const nowIso = new Date().toISOString().split('T')[0];

  const newRefund: RefundRow = {
    refund_id: refundId,
    order_number: cleanOrderNum,
    amount_zar: eligibility.amount_zar.toFixed(1),
    created_date: nowIso,
    status: 'completed'
  };

  try {
    db.addRefund(newRefund, cleanOrderNum);
  } catch (err: any) {
    return createError('unavailable', `Failed to write refund record: ${err.message}`, null, true, 2000);
  }

  const result: ProcessRefundResult = {
    status: 'completed',
    refund_id: refundId,
    order_number: cleanOrderNum,
    amount_zar: eligibility.amount_zar,
    processed_at: nowIso,
    refund_type: refundType,
    message: `Refund of R${eligibility.amount_zar.toFixed(2)} completed successfully with reference ${refundId}.`
  };

  db.setIdempotentResult(activeKey, result);

  db.logAudit({
    id: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    customer_id: requestingCustomerId || null,
    order_number: cleanOrderNum,
    action_type: 'REFUND_PROCESSED',
    result,
    rule_ids: eligibility.rule_ids,
    redacted_summary: `Refund ${refundId} completed for R${eligibility.amount_zar.toFixed(2)} on order ${cleanOrderNum}.`
  });

  return result;
}

// 6. escalate_to_human(reason_code, customer_id, order_number, summary)
// Creates support case in the appropriate queue; saves draft if db unavailable.
export interface EscalateResult {
  case_number: string;
  queue: string;
  expected_response_time: string;
  reason_code: string;
  summary: string;
}

export function escalateToHuman(
  reasonCode: string,
  customerId: string,
  orderNumber?: string,
  summary?: string,
  simulateDatabaseFailure: boolean = false
): EscalateResult | StructuredError {
  if (!reasonCode || !reasonCode.trim()) {
    return createError('validation', 'Reason code is required for escalation.', 'reason_code', true);
  }
  if (!customerId || !customerId.trim()) {
    return createError('validation', 'Customer ID is required for escalation.', 'customer_id', true);
  }

  const cleanCustId = customerId.trim().toUpperCase();
  const cleanOrderNum = orderNumber ? orderNumber.trim().toUpperCase() : '';
  const cleanSummary = (summary || `Escalation requested for ${reasonCode}`).trim();

  // Determine Queue & SLA
  let queue = 'General Support';
  let sla = '24 hours';
  let category = 'other';

  const codeUpper = reasonCode.toUpperCase();
  if (codeUpper.includes('FRAUD') || codeUpper.includes('SECURITY') || codeUpper.includes('HACK') || codeUpper.includes('UNAUTHORISED')) {
    queue = 'Security';
    sla = '2 hours';
    category = 'account';
  } else if (codeUpper.includes('LOCKED') || codeUpper.includes('SUSPENDED') || codeUpper.includes('IDENTITY') || codeUpper.includes('RECOVERY')) {
    queue = 'Account Recovery';
    sla = '4 hours';
    category = 'account';
  } else if (codeUpper.includes('REFUND_APPROVAL') || codeUpper.includes('HARD_LIMIT') || codeUpper.includes('HIGH_VALUE') || codeUpper.includes('LIMIT')) {
    queue = 'Refund Approvals';
    sla = '24 hours';
    category = 'refund';
  } else if (codeUpper.includes('LEGAL') || codeUpper.includes('OMBUD') || codeUpper.includes('REGULATOR') || codeUpper.includes('MANAGER') || codeUpper.includes('LAWYER')) {
    queue = 'Legal & Compliance';
    sla = '4 hours';
    category = 'other';
  } else if (codeUpper.includes('PARTIAL') || codeUpper.includes('BILLING') || codeUpper.includes('DUPLICATE') || codeUpper.includes('CONFLICT')) {
    queue = 'Billing';
    sla = '12 hours';
    category = 'billing';
  } else if (codeUpper.includes('ACCESS') || codeUpper.includes('DELIVERY') || codeUpper.includes('PENDING_ACCESS')) {
    queue = 'Technical Access';
    sla = '6 hours';
    category = 'access';
  }

  // Check if database unavailable / error fallback
  if (simulateDatabaseFailure) {
    const draftId = db.saveDraftCase({
      reason_code: reasonCode,
      customer_id: cleanCustId,
      order_number: cleanOrderNum,
      summary: cleanSummary
    });
    return createError(
      'unavailable',
      `Support case database is temporarily unavailable. Saved escalation draft ${draftId} in /drafts/ for review.`,
      null,
      true,
      3000
    );
  }

  const existingCases = db.getSupportCases();
  const nextCaseNum = 20000 + existingCases.length;
  const caseNumber = `CS-${nextCaseNum}`;
  const nowIso = new Date().toISOString().split('T')[0];

  const newCase: any = {
    case_number: caseNumber,
    customer_id: cleanCustId,
    opened_date: nowIso,
    category,
    status: 'open',
    summary: `${cleanSummary} [Queue: ${queue}]`
  };

  try {
    db.addSupportCase(newCase);
  } catch (err: any) {
    const draftId = db.saveDraftCase({
      reason_code: reasonCode,
      customer_id: cleanCustId,
      order_number: cleanOrderNum,
      summary: cleanSummary
    });
    return createError('unavailable', `Failed to create case in database: ${err.message}. Draft saved as ${draftId}.`, null, true, 3000);
  }

  const result: EscalateResult = {
    case_number: caseNumber,
    queue,
    expected_response_time: sla,
    reason_code: reasonCode,
    summary: cleanSummary
  };

  db.logAudit({
    id: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    customer_id: cleanCustId,
    order_number: cleanOrderNum || null,
    action_type: 'CASE_ESCALATED',
    result,
    rule_ids: ['G5'],
    redacted_summary: `Case ${caseNumber} opened in queue '${queue}' for customer ${cleanCustId}. Reason: ${reasonCode}. SLA: ${sla}.`
  });

  return result;
}
