/**
 * Shared Type Definitions for H9loop Support Resolver.
 */

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
}

export interface StructuredError {
  is_error: true;
  category: 'validation' | 'not_found' | 'permission' | 'policy' | 'timeout' | 'unavailable';
  retryable: boolean;
  retry_after_ms: number | null;
  field: string | null;
  message: string;
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

export interface ChatMessage {
  id: string;
  role: 'customer' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  wordCount?: number;
  decision?: DecisionRecord;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  customer_id: string | null;
  order_number: string | null;
  action_type: string;
  tool_name?: string;
  tool_args?: Record<string, any>;
  result?: any;
  rule_ids?: string[];
  redacted_summary: string;
}

export interface TestCaseResult {
  test_id: string;
  scenario_title: string;
  order_number: string;
  customer_id: string;
  is_designated_resolved: boolean;
  passed: boolean;
  observed_action: string;
  observed_reason: string;
  observed_rules: string[];
  db_state_verified: boolean;
  case_block_snapshot: ExactCaseBlock;
  dialogue_turns: number;
  evidence: string[];
  duration_ms: number;
}

export interface PolicyItem {
  policy_id: string;
  topic: string;
  rule_text: string;
  threshold_zar: string;
  escalate: string;
}
