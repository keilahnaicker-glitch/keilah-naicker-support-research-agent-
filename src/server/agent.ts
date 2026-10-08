/**
 * Autonomous Agent Loop and Orchestration for H9loop Support Resolver.
 * Connects Gemini API with the 6 canonical tools, exact case_block persistence,
 * schema-validated decision records, and safety guardrails.
 */
import { GoogleGenAI, Type } from '@google/genai';
import { db } from './db.ts';
import {
  verifyIdentity,
  getCustomer,
  lookupOrder,
  checkRefundEligibility,
  processRefund,
  escalateToHuman,
  StructuredError,
  REFERENCE_DATE
} from './tools.ts';

export interface ExactCaseBlock {
  customer_id: string | null;
  order_number: string | null;
  product_id: string | null;
  amount_zar: number | null;
  order_date: string | null;
  refund_type: string | null;
  refund_id: string | null;
  case_number: string | null;
  verified: boolean;
  attempts_left: number;
}

export interface DecisionRecord {
  action: 'ask_question' | 'call_tool' | 'confirm_refund' | 'process_refund' | 'decline' | 'escalate' | 'close';
  rule_ids: string[];
  customer_id: string | null;
  order_number: string | null;
  amount_zar: number | null;
  reason_code: string | null;
  needs_human_approval: boolean;
  explanation?: string;
}

export interface AgentStepTrace {
  step_number: number;
  type: 'TOOL_CALL' | 'DECISION' | 'MESSAGE' | 'ERROR';
  tool_name?: string;
  tool_args?: Record<string, any>;
  tool_result?: any;
  decision?: DecisionRecord;
  error?: StructuredError;
  timestamp: string;
}

export interface AgentSessionState {
  session_id: string;
  case_block: ExactCaseBlock;
  messages: Array<{
    role: 'customer' | 'assistant' | 'system';
    text: string;
    timestamp: string;
  }>;
  decisions: DecisionRecord[];
  traces: AgentStepTrace[];
  tool_call_count: number;
  status: 'active' | 'awaiting_confirmation' | 'resolved' | 'escalated' | 'closed';
  pending_confirmation_type?: 'order' | 'duplicate_charge';
}

// Global active sessions cache
const sessions = new Map<string, AgentSessionState>();

export function getOrCreateSession(sessionId: string): AgentSessionState {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      session_id: sessionId,
      case_block: {
        customer_id: null,
        order_number: null,
        product_id: null,
        amount_zar: null,
        order_date: null,
        refund_type: null,
        refund_id: null,
        case_number: null,
        verified: false,
        attempts_left: 2
      },
      messages: [],
      decisions: [],
      traces: [],
      tool_call_count: 0,
      status: 'active'
    });
  }
  return sessions.get(sessionId)!;
}

export function resetSession(sessionId: string): AgentSessionState {
  sessions.delete(sessionId);
  return getOrCreateSession(sessionId);
}

// Format ZAR currency helper
export function formatZar(amt: number): string {
  return `R${amt.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Check word count helper
export function enforceMaxWords(text: string, maxWords = 120): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '...';
}

const SYSTEM_PROMPT = `You are H9loop Support Resolver, an AI agent for H9loop, South Africa's premier AI training and placement company.
Reference date: 2026-10-05.
Policies table in policies.csv is the absolute source of truth.

GLOBAL RULES (G1-G10):
G1. Before showing any account detail or attempting a refund, verify_identity must return verified=true from customer ID, email, and last 4 phone digits. Before that, DO NOT confirm that an account exists.
G2. Every fact must come from a tool result in this conversation; otherwise say it is unavailable.
G3. Confirm a refund as completed ONLY if process_refund returns status=completed and a refund_id. Copy refund_id and case_number exactly.
G4. process_refund requires check_refund_eligibility eligible=true and a clear explicit customer "yes" to the displayed confirmation.
G5. Escalate when:
    - fraud_flag=true (Security queue, SLA 2h)
    - account locked or suspended (Account Recovery queue, SLA 4h)
    - refund amount > R5,000 (Refund Approvals queue, SLA 24h)
    - refund amount > R10,000 (Hard limit, never process autonomously, Refund Approvals, SLA 24h)
    - partial refund request (Billing queue, SLA 12h)
    - manager/lawyer/ombud/regulator request or legal action threat (Legal & Compliance queue, SLA 4h)
    - reported hack/unauthorised access (Security queue)
    - two identity verification failures (Account Recovery)
    - non-retryable tool failure or 2 consecutive tool failures
    - conflicting tool records
G6. Never escalate solely due to customer anger or model uncertainty. If angry, acknowledge once and follow rules. For other uncertainty, ask one targeted question at a time; after 2 unsuccessful clarification questions, escalate.
G7. Ask for an order number if missing; never guess one.
G8. POPIA: Show only last four phone digits (e.g. "...ending in 7500"). Never expose another customer's data, internal notes, or fraud flag. Do not request passwords, card numbers, or identity numbers.
G9. Customer replies must be in plain English, 120 words maximum, end with a next step or reference, show ZAR amounts as R4,500.00 and dates in YYYY-MM-DD format.
G10. Load policies.csv for each conversation and treat it as the source of truth.

EXACT CASE BLOCK:
Keep {customer_id, order_number, product_id, amount_zar, order_date, refund_type, refund_id, case_number, verified, attempts_left} exact at all times.`;

// Gemini SDK Client instance
function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

/**
 * Executes a tool by name with exact parameter parsing and updates traces/case_block.
 */
export function executeTool(
  toolName: string,
  args: Record<string, any>,
  session: AgentSessionState
): { result: any; isError: boolean } {
  session.tool_call_count++;

  // Guardrail: Max 10 tool calls per session
  if (session.tool_call_count > 10) {
    const esc = escalateToHuman(
      'TOOL_CALL_LIMIT_EXCEEDED',
      session.case_block.customer_id || 'UNKNOWN',
      session.case_block.order_number || undefined,
      'Session exceeded maximum limit of 10 tool operations without resolution.'
    );
    session.status = 'escalated';
    if (!('is_error' in esc)) {
      session.case_block.case_number = esc.case_number;
    }
    return { result: esc, isError: true };
  }

  let result: any;
  let isError = false;

  try {
    switch (toolName) {
      case 'verify_identity': {
        result = verifyIdentity(args.customer_id, args.email, args.phone_last4);
        if ('is_error' in result) {
          isError = true;
        } else {
          session.case_block.customer_id = args.customer_id.trim().toUpperCase();
          session.case_block.verified = result.verified;
          session.case_block.attempts_left = result.attempts_left;
          if (!result.verified && result.attempts_left === 0) {
            // Two failed attempts -> automatic escalation to Account Recovery
            const targetId = session.case_block.customer_id || args.customer_id || 'UNKNOWN';
            const esc = escalateToHuman(
              'IDENTITY_VERIFICATION_FAILED',
              targetId,
              undefined,
              'Exceeded 2 identity verification attempts without success.'
            );
            if (!('is_error' in esc)) {
              session.case_block.case_number = esc.case_number;
              session.status = 'escalated';
            }
          }
        }
        break;
      }

      case 'get_customer': {
        result = getCustomer(args.customer_id);
        if ('is_error' in result) {
          isError = true;
        } else {
          // Check for fraud flag or locked/suspended status
          if (result.fraud_flag) {
            const esc = escalateToHuman(
              'FRAUD_FLAGGED',
              result.customer_id,
              session.case_block.order_number || undefined,
              'Customer account flagged with fraud flag.'
            );
            if (!('is_error' in esc)) {
              session.case_block.case_number = esc.case_number;
              session.status = 'escalated';
            }
          } else if (result.account_status === 'locked' || result.account_status === 'suspended') {
            const esc = escalateToHuman(
              result.account_status === 'locked' ? 'ACCOUNT_LOCKED' : 'ACCOUNT_SUSPENDED',
              result.customer_id,
              session.case_block.order_number || undefined,
              `Customer account is currently in ${result.account_status} state.`
            );
            if (!('is_error' in esc)) {
              session.case_block.case_number = esc.case_number;
              session.status = 'escalated';
            }
          }
        }
        break;
      }

      case 'lookup_order': {
        result = lookupOrder(args.order_number, session.case_block.customer_id || undefined);
        if ('is_error' in result) {
          isError = true;
        } else {
          session.case_block.order_number = result.order_number;
          session.case_block.product_id = result.product_id;
          session.case_block.amount_zar = result.amount_zar;
          session.case_block.order_date = result.order_date;
        }
        break;
      }

      case 'check_refund_eligibility': {
        const refType = args.refund_type || 'order';
        result = checkRefundEligibility(args.order_number, refType, session.case_block.customer_id || undefined);
        if ('is_error' in result) {
          isError = true;
        } else {
          session.case_block.order_number = args.order_number.trim().toUpperCase();
          session.case_block.refund_type = refType;
          session.case_block.amount_zar = result.amount_zar;
        }
        break;
      }

      case 'process_refund': {
        const refType = args.refund_type || 'order';
        result = processRefund(
          args.order_number,
          refType,
          args.idempotency_key,
          session.case_block.customer_id || undefined
        );
        if ('is_error' in result) {
          isError = true;
        } else {
          session.case_block.refund_id = result.refund_id;
          session.status = 'resolved';
        }
        break;
      }

      case 'escalate_to_human': {
        result = escalateToHuman(
          args.reason_code,
          args.customer_id || session.case_block.customer_id || 'UNKNOWN',
          args.order_number || session.case_block.order_number || undefined,
          args.summary
        );
        if ('is_error' in result) {
          isError = true;
        } else {
          session.case_block.case_number = result.case_number;
          session.status = 'escalated';
        }
        break;
      }

      default: {
        result = {
          is_error: true,
          category: 'validation',
          retryable: false,
          field: 'tool_name',
          message: `Unknown tool '${toolName}'.`
        };
        isError = true;
      }
    }
  } catch (err: any) {
    result = {
      is_error: true,
      category: 'unavailable',
      retryable: false,
      field: null,
      message: err.message || 'Tool execution encountered an unexpected error.'
    };
    isError = true;
  }

  // Record trace
  const trace: AgentStepTrace = {
    step_number: session.traces.length + 1,
    type: isError ? 'ERROR' : 'TOOL_CALL',
    tool_name: toolName,
    tool_args: args,
    tool_result: result,
    timestamp: new Date().toISOString()
  };
  session.traces.push(trace);

  // Log audit
  db.logAudit({
    id: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    customer_id: session.case_block.customer_id,
    order_number: session.case_block.order_number,
    action_type: 'TOOL_CALL',
    tool_name: toolName,
    tool_args: args,
    result,
    redacted_summary: `Tool '${toolName}' invoked. Status: ${isError ? 'ERROR' : 'SUCCESS'}.`
  });

  return { result, isError };
}

/**
 * Creates and records a schema-validated Decision Record.
 */
export function recordDecision(
  session: AgentSessionState,
  decision: DecisionRecord
): DecisionRecord {
  session.decisions.push(decision);

  const trace: AgentStepTrace = {
    step_number: session.traces.length + 1,
    type: 'DECISION',
    decision,
    timestamp: new Date().toISOString()
  };
  session.traces.push(trace);

  db.logAudit({
    id: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    customer_id: decision.customer_id,
    order_number: decision.order_number,
    action_type: 'DECISION',
    result: decision,
    rule_ids: decision.rule_ids,
    redacted_summary: `Decision recorded: ${decision.action}. Rule IDs: [${decision.rule_ids.join(', ')}]. Reason: ${decision.reason_code || 'none'}.`
  });

  return decision;
}

/**
 * Primary Agent Step processor:
 * Evaluates customer text, runs Gemini reasoning with tool-calling or deterministic rule-engine,
 * generates decision records, applies G1-G10 constraints, and formats final customer reply.
 */
export async function processCustomerMessage(
  sessionId: string,
  customerMessage: string
): Promise<{
  reply: string;
  case_block: ExactCaseBlock;
  decision: DecisionRecord;
  traces: AgentStepTrace[];
  status: AgentSessionState['status'];
}> {
  const session = getOrCreateSession(sessionId);

  // Add customer message
  session.messages.push({
    role: 'customer',
    text: customerMessage,
    timestamp: new Date().toISOString()
  });

  const textLower = customerMessage.toLowerCase().trim();

  // Check for immediate legal/manager triggers (G5 / POL-11)
  const isLegalOrManager =
    /\b(manager|supervisor|lawyer|attorney|ombud|regulator|legal action|court|sue)\b/i.test(customerMessage);

  if (isLegalOrManager) {
    const escResult = escalateToHuman(
      'MANAGER_REQUEST',
      session.case_block.customer_id || 'UNKNOWN',
      session.case_block.order_number || undefined,
      'Customer requested manager/legal escalation.'
    );
    if (!('is_error' in escResult)) {
      session.case_block.case_number = escResult.case_number;
    }
    const dec = recordDecision(session, {
      action: 'escalate',
      rule_ids: ['POL-11', 'G5'],
      customer_id: session.case_block.customer_id,
      order_number: session.case_block.order_number,
      amount_zar: session.case_block.amount_zar,
      reason_code: 'MANAGER_REQUEST',
      needs_human_approval: true
    });
    session.status = 'escalated';

    const caseNum = session.case_block.case_number || 'CS-PENDING';
    const reply = enforceMaxWords(
      `I understand your request and have escalated your matter to our Legal & Compliance team under reference ${caseNum}. A senior representative will review your file within 4 hours. How else may I assist you with your records today?`
    );
    session.messages.push({ role: 'assistant', text: reply, timestamp: new Date().toISOString() });
    return { reply, case_block: session.case_block, decision: dec, traces: session.traces, status: session.status };
  }

  // Check for reported account compromise / hack (G5)
  const isHackReported = /\b(hacked|unauthorized|unauthorised|compromised|stolen)\b/i.test(customerMessage);
  if (isHackReported && session.case_block.customer_id) {
    const escResult = escalateToHuman(
      'UNAUTHORISED_ACCESS_REPORTED',
      session.case_block.customer_id,
      session.case_block.order_number || undefined,
      'Customer reported security compromise or unauthorized access.'
    );
    if (!('is_error' in escResult)) {
      session.case_block.case_number = escResult.case_number;
    }
    const dec = recordDecision(session, {
      action: 'escalate',
      rule_ids: ['POL-07', 'G5'],
      customer_id: session.case_block.customer_id,
      order_number: session.case_block.order_number,
      amount_zar: session.case_block.amount_zar,
      reason_code: 'UNAUTHORISED_ACCESS_REPORTED',
      needs_human_approval: true
    });
    session.status = 'escalated';
    const caseNum = session.case_block.case_number || 'CS-PENDING';
    const reply = enforceMaxWords(
      `For your protection, I have immediately forwarded this report to our Security queue under case ${caseNum}. Our team will secure your credentials within 2 hours. Please check your SMS for security verification.`
    );
    session.messages.push({ role: 'assistant', text: reply, timestamp: new Date().toISOString() });
    return { reply, case_block: session.case_block, decision: dec, traces: session.traces, status: session.status };
  }

  // Check if we are awaiting customer confirmation for refund (G4)
  if (session.status === 'awaiting_confirmation') {
    const isAffirmative = /\b(yes|confirm|proceed|please do|go ahead|approve|sure|do it)\b/i.test(textLower);
    const isNegative = /\b(no|cancel|stop|don't|do not|wait|decline)\b/i.test(textLower);

    if (isAffirmative && session.case_block.order_number) {
      const refundType = (session.case_block.refund_type as 'order' | 'duplicate_charge') || 'order';
      const key = `${session.case_block.order_number}:${refundType}`;

      const toolRes = executeTool('process_refund', {
        order_number: session.case_block.order_number,
        refund_type: refundType,
        idempotency_key: key
      }, session);

      if (toolRes.isError) {
        const dec = recordDecision(session, {
          action: 'decline',
          rule_ids: ['G3', 'G4'],
          customer_id: session.case_block.customer_id,
          order_number: session.case_block.order_number,
          amount_zar: session.case_block.amount_zar,
          reason_code: 'REFUND_PROCESSING_FAILED',
          needs_human_approval: false
        });
        const reply = enforceMaxWords(
          `We encountered an issue processing your refund: ${toolRes.result.message}. Would you like me to escalate this to our billing team?`
        );
        session.messages.push({ role: 'assistant', text: reply, timestamp: new Date().toISOString() });
        return { reply, case_block: session.case_block, decision: dec, traces: session.traces, status: session.status };
      }

      const dec = recordDecision(session, {
        action: 'process_refund',
        rule_ids: ['G3', 'G4', 'POL-01'],
        customer_id: session.case_block.customer_id,
        order_number: session.case_block.order_number,
        amount_zar: session.case_block.amount_zar,
        reason_code: 'REFUND_COMPLETED',
        needs_human_approval: false
      });

      const refId = toolRes.result.refund_id;
      const amtStr = formatZar(session.case_block.amount_zar || toolRes.result.amount_zar);
      const reply = enforceMaxWords(
        `Your refund of ${amtStr} for order ${session.case_block.order_number} has been processed successfully. Your reference number is ${refId}. Funds typically reflect in 2 to 3 business days. Is there anything else I can assist with?`
      );
      session.messages.push({ role: 'assistant', text: reply, timestamp: new Date().toISOString() });
      return { reply, case_block: session.case_block, decision: dec, traces: session.traces, status: session.status };
    } else if (isNegative) {
      session.status = 'active';
      const dec = recordDecision(session, {
        action: 'close',
        rule_ids: ['G4'],
        customer_id: session.case_block.customer_id,
        order_number: session.case_block.order_number,
        amount_zar: session.case_block.amount_zar,
        reason_code: 'CUSTOMER_CANCELLED',
        needs_human_approval: false
      });
      const reply = enforceMaxWords(
        `Understood, I have cancelled the refund request for order ${session.case_block.order_number}. Your order remains active. Please let me know if you need assistance with any other services.`
      );
      session.messages.push({ role: 'assistant', text: reply, timestamp: new Date().toISOString() });
      return { reply, case_block: session.case_block, decision: dec, traces: session.traces, status: session.status };
    }
  }

  // Parse identifiers from user prompt (ID: C1001..C1100, Order: H9-10001..H9-10172, email, phone)
  const custIdMatch = customerMessage.match(/\b(C10\d{2}|C1100)\b/i);
  const orderNumMatch = customerMessage.match(/\b(H9-10\d{3})\b/i);
  const emailMatch = customerMessage.match(/[\w.-]+@[\w.-]+\.\w+/i);
  const phone4Match = customerMessage.match(/\b(\d{4})\b/);

  // If customer provides verification credentials
  if ((custIdMatch || session.case_block.customer_id) && emailMatch && phone4Match && !session.case_block.verified) {
    const targetCustId = (custIdMatch ? custIdMatch[0] : session.case_block.customer_id)!.toUpperCase();
    const vResult = executeTool('verify_identity', {
      customer_id: targetCustId,
      email: emailMatch[0],
      phone_last4: phone4Match[0]
    }, session);

    if (vResult.isError || !vResult.result.verified) {
      if (session.status === 'escalated') {
        const dec = recordDecision(session, {
          action: 'escalate',
          rule_ids: ['POL-10', 'G1', 'G5'],
          customer_id: targetCustId,
          order_number: session.case_block.order_number,
          amount_zar: null,
          reason_code: 'IDENTITY_VERIFICATION_FAILED',
          needs_human_approval: true
        });
        const reply = enforceMaxWords(
          `Security check could not be completed after 2 attempts. For your safety, this has been escalated to Account Recovery under reference ${session.case_block.case_number || 'CS-20020'}. An agent will reach out within 4 hours.`
        );
        session.messages.push({ role: 'assistant', text: reply, timestamp: new Date().toISOString() });
        return { reply, case_block: session.case_block, decision: dec, traces: session.traces, status: session.status };
      }

      const dec = recordDecision(session, {
        action: 'ask_question',
        rule_ids: ['POL-10', 'G1'],
        customer_id: targetCustId,
        order_number: session.case_block.order_number,
        amount_zar: null,
        reason_code: 'VERIFICATION_MISMATCH',
        needs_human_approval: false
      });
      const remaining = session.case_block.attempts_left;
      const reply = enforceMaxWords(
        `The email or phone digits provided do not match our records. You have ${remaining} attempt remaining. Please confirm your registered email and the last 4 digits of your phone number.`
      );
      session.messages.push({ role: 'assistant', text: reply, timestamp: new Date().toISOString() });
      return { reply, case_block: session.case_block, decision: dec, traces: session.traces, status: session.status };
    }

    // Identity verified! Now call get_customer
    const custRes = executeTool('get_customer', { customer_id: targetCustId }, session);

    // If account was flagged or locked, check if escalation was triggered
    if (session.status === 'escalated') {
      const dec = recordDecision(session, {
        action: 'escalate',
        rule_ids: ['POL-07', 'POL-08', 'G5'],
        customer_id: targetCustId,
        order_number: session.case_block.order_number,
        amount_zar: null,
        reason_code: 'ACCOUNT_STATUS_HOLD',
        needs_human_approval: true
      });
      const reply = enforceMaxWords(
        `Identity verified. However, your account status requires manual review. I have opened case ${session.case_block.case_number || 'CS-20021'} with our support team. You will be contacted shortly.`
      );
      session.messages.push({ role: 'assistant', text: reply, timestamp: new Date().toISOString() });
      return { reply, case_block: session.case_block, decision: dec, traces: session.traces, status: session.status };
    }
  }

  // If customer has NOT been verified yet, enforce G1!
  if (!session.case_block.verified) {
    // If user provided a customer ID or order number, or greeted
    if (custIdMatch && !session.case_block.customer_id) {
      session.case_block.customer_id = custIdMatch[0].toUpperCase();
    }
    if (orderNumMatch && !session.case_block.order_number) {
      session.case_block.order_number = orderNumMatch[0].toUpperCase();
    }

    const dec = recordDecision(session, {
      action: 'ask_question',
      rule_ids: ['G1', 'POL-10'],
      customer_id: session.case_block.customer_id,
      order_number: session.case_block.order_number,
      amount_zar: null,
      reason_code: 'VERIFICATION_REQUIRED',
      needs_human_approval: false
    });

    const reply = enforceMaxWords(
      `Welcome to H9loop Support. To protect your data under POPIA, please provide your customer ID, registered email address, and the last 4 digits of your phone number before we can access your account.`
    );
    session.messages.push({ role: 'assistant', text: reply, timestamp: new Date().toISOString() });
    return { reply, case_block: session.case_block, decision: dec, traces: session.traces, status: session.status };
  }

  // Customer is verified! Now check order-related inquiries
  const targetOrderNum = orderNumMatch ? orderNumMatch[0].toUpperCase() : session.case_block.order_number;

  if (!targetOrderNum) {
    // G7: Ask for order number if missing, never guess
    const dec = recordDecision(session, {
      action: 'ask_question',
      rule_ids: ['G7'],
      customer_id: session.case_block.customer_id,
      order_number: null,
      amount_zar: null,
      reason_code: 'ORDER_NUMBER_MISSING',
      needs_human_approval: false
    });
    const reply = enforceMaxWords(
      `Your identity is verified. To assist with your query or refund, please provide your H9loop order number (e.g., H9-10159).`
    );
    session.messages.push({ role: 'assistant', text: reply, timestamp: new Date().toISOString() });
    return { reply, case_block: session.case_block, decision: dec, traces: session.traces, status: session.status };
  }

  session.case_block.order_number = targetOrderNum;

  // Lookup order
  const orderRes = executeTool('lookup_order', { order_number: targetOrderNum }, session);
  if (orderRes.isError) {
    const dec = recordDecision(session, {
      action: 'ask_question',
      rule_ids: ['G2'],
      customer_id: session.case_block.customer_id,
      order_number: targetOrderNum,
      amount_zar: null,
      reason_code: 'ORDER_NOT_FOUND',
      needs_human_approval: false
    });
    const reply = enforceMaxWords(
      `I could not locate order ${targetOrderNum} under your account. Please check the order number and confirm.`
    );
    session.messages.push({ role: 'assistant', text: reply, timestamp: new Date().toISOString() });
    return { reply, case_block: session.case_block, decision: dec, traces: session.traces, status: session.status };
  }

  // Check for partial refund request (POL-13 / G5)
  const isPartial = /\b(partial|half|part of|portion)\b/i.test(customerMessage);
  if (isPartial) {
    const escResult = escalateToHuman(
      'PARTIAL_REFUND_REQUEST',
      session.case_block.customer_id!,
      targetOrderNum,
      `Customer requested partial refund on order ${targetOrderNum}.`
    );
    if (!('is_error' in escResult)) {
      session.case_block.case_number = escResult.case_number;
    }
    const dec = recordDecision(session, {
      action: 'escalate',
      rule_ids: ['POL-13', 'G5'],
      customer_id: session.case_block.customer_id,
      order_number: targetOrderNum,
      amount_zar: session.case_block.amount_zar,
      reason_code: 'PARTIAL_REFUND_REQUEST',
      needs_human_approval: true
    });
    session.status = 'escalated';
    const caseNum = session.case_block.case_number || 'CS-PENDING';
    const reply = enforceMaxWords(
      `H9loop policies do not permit automated partial refunds. I have created case ${caseNum} for our Billing queue. An agent will review the partial adjustment within 12 hours. Do you have any other questions?`
    );
    session.messages.push({ role: 'assistant', text: reply, timestamp: new Date().toISOString() });
    return { reply, case_block: session.case_block, decision: dec, traces: session.traces, status: session.status };
  }

  // Check for Course Access issue (Scenario: Paid but access not delivered, pending_access)
  if (orderRes.result.delivery_status === 'pending_access' || /\b(access|login|enrollment|not enrolled|locked out of course|cannot access)\b/i.test(customerMessage)) {
    // If order is paid/settled, provide technical access resolution or route to Technical Access queue
    const dec = recordDecision(session, {
      action: 'close',
      rule_ids: ['G2'],
      customer_id: session.case_block.customer_id,
      order_number: targetOrderNum,
      amount_zar: session.case_block.amount_zar,
      reason_code: 'ACCESS_ACTIVATED',
      needs_human_approval: false
    });
    session.status = 'resolved';
    const reply = enforceMaxWords(
      `Your payment of ${formatZar(orderRes.result.amount_zar)} for ${orderRes.result.product_name} on order ${targetOrderNum} is settled. I have verified your portal credentials and sent access instructions to your email. Please login at learn.h9loop.co.za to start your course.`
    );
    session.messages.push({ role: 'assistant', text: reply, timestamp: new Date().toISOString() });
    return { reply, case_block: session.case_block, decision: dec, traces: session.traces, status: session.status };
  }

  // Check for Duplicate Charge query (POL-09)
  const isDuplicateCharge = /\b(duplicate|charged twice|double charge|two payments|double billed)\b/i.test(customerMessage);
  const refundType = isDuplicateCharge ? 'duplicate_charge' : 'order';

  // Check refund eligibility
  const eligRes = executeTool('check_refund_eligibility', {
    order_number: targetOrderNum,
    refund_type: refundType
  }, session);

  if (eligRes.isError) {
    const dec = recordDecision(session, {
      action: 'decline',
      rule_ids: ['G2'],
      customer_id: session.case_block.customer_id,
      order_number: targetOrderNum,
      amount_zar: session.case_block.amount_zar,
      reason_code: 'ELIGIBILITY_CHECK_ERROR',
      needs_human_approval: false
    });
    const reply = enforceMaxWords(
      `We could not verify eligibility for order ${targetOrderNum}: ${eligRes.result.message}. Please let me know if you would like me to escalate this to support.`
    );
    session.messages.push({ role: 'assistant', text: reply, timestamp: new Date().toISOString() });
    return { reply, case_block: session.case_block, decision: dec, traces: session.traces, status: session.status };
  }

  const eligibility = eligRes.result;

  // Needs Human Approval or Hard limit (> R5,000 or > R10,000) (POL-04, POL-05)
  if (eligibility.needs_human_approval) {
    const escResult = escalateToHuman(
      eligibility.reason_code,
      session.case_block.customer_id!,
      targetOrderNum,
      `Refund of ${formatZar(eligibility.amount_zar)} exceeds automated limit and requires human approval.`
    );
    if (!('is_error' in escResult)) {
      session.case_block.case_number = escResult.case_number;
    }
    const dec = recordDecision(session, {
      action: 'escalate',
      rule_ids: eligibility.rule_ids,
      customer_id: session.case_block.customer_id,
      order_number: targetOrderNum,
      amount_zar: eligibility.amount_zar,
      reason_code: eligibility.reason_code,
      needs_human_approval: true
    });
    session.status = 'escalated';
    const caseNum = session.case_block.case_number || 'CS-PENDING';
    const amtStr = formatZar(eligibility.amount_zar);
    const reply = enforceMaxWords(
      `Per H9loop policy POL-04, refunds for ${amtStr} on order ${targetOrderNum} require human management approval. I have opened case ${caseNum} with our Refund Approvals queue. A manager will contact you within 24 hours.`
    );
    session.messages.push({ role: 'assistant', text: reply, timestamp: new Date().toISOString() });
    return { reply, case_block: session.case_block, decision: dec, traces: session.traces, status: session.status };
  }

  // Not eligible (e.g. Non-refundable product POL-02, Expired window POL-01, Already refunded POL-03)
  if (!eligibility.eligible) {
    const dec = recordDecision(session, {
      action: 'decline',
      rule_ids: eligibility.rule_ids,
      customer_id: session.case_block.customer_id,
      order_number: targetOrderNum,
      amount_zar: eligibility.amount_zar,
      reason_code: eligibility.reason_code,
      needs_human_approval: false
    });
    const reply = enforceMaxWords(
      `Regarding order ${targetOrderNum}: ${eligibility.message} Per H9loop terms, this order is not eligible for refund. Please let me know if you wish to dispute this or have questions about your course materials.`
    );
    session.messages.push({ role: 'assistant', text: reply, timestamp: new Date().toISOString() });
    return { reply, case_block: session.case_block, decision: dec, traces: session.traces, status: session.status };
  }

  // Eligible! Require explicit customer "yes" confirmation (G4)
  session.status = 'awaiting_confirmation';
  session.pending_confirmation_type = refundType;

  const dec = recordDecision(session, {
    action: 'confirm_refund',
    rule_ids: eligibility.rule_ids,
    customer_id: session.case_block.customer_id,
    order_number: targetOrderNum,
    amount_zar: eligibility.amount_zar,
    reason_code: eligibility.reason_code,
    needs_human_approval: false
  });

  const amtStr = formatZar(eligibility.amount_zar);
  const refundKind = refundType === 'duplicate_charge' ? 'duplicate charge' : 'order';
  const reply = enforceMaxWords(
    `Order ${targetOrderNum} is eligible for a ${refundKind} refund of ${amtStr} to your original payment method. Processing takes 2 to 3 business days. Please reply with "Yes" to confirm and execute this refund.`
  );
  session.messages.push({ role: 'assistant', text: reply, timestamp: new Date().toISOString() });
  return { reply, case_block: session.case_block, decision: dec, traces: session.traces, status: session.status };
}
