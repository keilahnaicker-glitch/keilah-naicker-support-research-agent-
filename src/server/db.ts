/**
 * Storage and Database manager for H9loop Support Resolver.
 * Operates strictly on the 7 CSV files in /data_work/, backed by /h9loop_support/data_original/.
 * Creates timestamped snapshots in /backups/ before any write.
 * Emits redacted POPIA logs in /audit_trail/.
 */
import fs from 'fs';
import path from 'path';
import { parseCsv, stringifyCsv } from './csv_utils.ts';

const ROOT_DIR = process.cwd();
export const DATA_ORIGINAL_DIR = path.join(ROOT_DIR, 'h9loop_support', 'data_original');
export const DATA_WORK_DIR = path.join(ROOT_DIR, 'data_work');
export const BACKUPS_DIR = path.join(ROOT_DIR, 'backups');
export const DRAFTS_DIR = path.join(ROOT_DIR, 'drafts');
export const AUDIT_DIR = path.join(ROOT_DIR, 'audit_trail');

export interface CustomerRow {
  customer_id: string;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  province: string;
  client_type: string;
  company: string;
  membership_status: string;
  account_status: string;
  fraud_flag: string; // "0" | "1"
  popia_marketing_consent: string;
  verification_phone_last4: string;
  joined_date: string;
  open_cases: string;
}

export interface ProductRow {
  product_id: string;
  name: string;
  category: string;
  price_zar: string;
  is_digital: string;
  is_subscription: string;
  refundable: string; // "0" | "1"
}

export interface OrderRow {
  order_number: string;
  customer_id: string;
  product_id: string;
  order_date: string;
  amount_zar: string;
  delivery_status: string;
  delivery_date: string;
  refund_window_ends: string;
  payment_method: string;
  refund_status: string; // "none" | "refunded"
  notes: string;
}

export interface PaymentRow {
  transaction_id: string;
  order_number: string;
  customer_id: string;
  amount_zar: string;
  payment_date: string;
  status: string; // "settled" | etc.
  method: string;
}

export interface RefundRow {
  refund_id: string;
  order_number: string;
  amount_zar: string;
  created_date: string;
  status: string; // "completed"
}

export interface SupportCaseRow {
  case_number: string;
  customer_id: string;
  opened_date: string;
  category: string;
  status: string;
  summary: string;
}

export interface PolicyRow {
  policy_id: string;
  topic: string;
  rule_text: string;
  threshold_zar: string;
  escalate: string; // "0" | "1"
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  customer_id: string | null;
  order_number: string | null;
  action_type: 'TOOL_CALL' | 'DECISION' | 'REFUND_PROCESSED' | 'CASE_ESCALATED' | 'BACKUP_CREATED' | 'IDENTITY_CHECK';
  tool_name?: string;
  tool_args?: Record<string, any>;
  result?: any;
  rule_ids?: string[];
  redacted_summary: string;
}

class H9Database {
  private idempotencyStore: Map<string, any> = new Map();
  // Verification attempts track per customer: { attemptsLeft: number, verified: boolean }
  private sessionVerification: Map<string, { attemptsLeft: number; verified: boolean }> = new Map();

  constructor() {
    this.ensureDirectories();
  }

  public ensureDirectories() {
    [DATA_ORIGINAL_DIR, DATA_WORK_DIR, BACKUPS_DIR, DRAFTS_DIR, AUDIT_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // If data_work is empty, copy from data_original
    const tables = ['customers', 'products', 'orders', 'payments', 'refunds', 'support_cases', 'policies'];
    tables.forEach(table => {
      const workFile = path.join(DATA_WORK_DIR, `${table}.csv`);
      const origFile = path.join(DATA_ORIGINAL_DIR, `${table}.csv`);
      if (!fs.existsSync(workFile) && fs.existsSync(origFile)) {
        fs.copyFileSync(origFile, workFile);
      }
    });
  }

  public resetToOriginal() {
    this.ensureDirectories();
    const tables = ['customers', 'products', 'orders', 'payments', 'refunds', 'support_cases', 'policies'];
    tables.forEach(table => {
      const workFile = path.join(DATA_WORK_DIR, `${table}.csv`);
      const origFile = path.join(DATA_ORIGINAL_DIR, `${table}.csv`);
      if (fs.existsSync(origFile)) {
        fs.copyFileSync(origFile, workFile);
      }
    });
    this.idempotencyStore.clear();
    this.sessionVerification.clear();
    this.logAudit({
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      customer_id: null,
      order_number: null,
      action_type: 'BACKUP_CREATED',
      redacted_summary: 'Database reset to original baseline dataset'
    });
  }

  public createSnapshot(reason: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotDir = path.join(BACKUPS_DIR, `snapshot_${timestamp}`);
    fs.mkdirSync(snapshotDir, { recursive: true });

    const tables = ['customers', 'products', 'orders', 'payments', 'refunds', 'support_cases', 'policies'];
    tables.forEach(table => {
      const src = path.join(DATA_WORK_DIR, `${table}.csv`);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(snapshotDir, `${table}.csv`));
      }
    });

    const meta = {
      timestamp: new Date().toISOString(),
      reason,
      tables
    };
    fs.writeFileSync(path.join(snapshotDir, 'snapshot_meta.json'), JSON.stringify(meta, null, 2));

    this.logAudit({
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      customer_id: null,
      order_number: null,
      action_type: 'BACKUP_CREATED',
      redacted_summary: `Snapshot created: snapshot_${timestamp} for ${reason}`
    });

    return snapshotDir;
  }

  // --- Reading tables ---

  public getPolicies(): PolicyRow[] {
    const file = path.join(DATA_WORK_DIR, 'policies.csv');
    if (!fs.existsSync(file)) {
      throw new Error('policies.csv cannot be loaded.');
    }
    return parseCsv<PolicyRow>(fs.readFileSync(file, 'utf-8'));
  }

  public getCustomers(): CustomerRow[] {
    const file = path.join(DATA_WORK_DIR, 'customers.csv');
    return parseCsv<CustomerRow>(fs.readFileSync(file, 'utf-8'));
  }

  public getProducts(): ProductRow[] {
    const file = path.join(DATA_WORK_DIR, 'products.csv');
    return parseCsv<ProductRow>(fs.readFileSync(file, 'utf-8'));
  }

  public getOrders(): OrderRow[] {
    const file = path.join(DATA_WORK_DIR, 'orders.csv');
    return parseCsv<OrderRow>(fs.readFileSync(file, 'utf-8'));
  }

  public getPayments(): PaymentRow[] {
    const file = path.join(DATA_WORK_DIR, 'payments.csv');
    return parseCsv<PaymentRow>(fs.readFileSync(file, 'utf-8'));
  }

  public getRefunds(): RefundRow[] {
    const file = path.join(DATA_WORK_DIR, 'refunds.csv');
    return parseCsv<RefundRow>(fs.readFileSync(file, 'utf-8'));
  }

  public getSupportCases(): SupportCaseRow[] {
    const file = path.join(DATA_WORK_DIR, 'support_cases.csv');
    return parseCsv<SupportCaseRow>(fs.readFileSync(file, 'utf-8'));
  }

  // --- Verification State ---

  public getCustomerVerification(customerId: string): { attemptsLeft: number; verified: boolean } {
    if (!this.sessionVerification.has(customerId)) {
      this.sessionVerification.set(customerId, { attemptsLeft: 2, verified: false });
    }
    return this.sessionVerification.get(customerId)!;
  }

  public setCustomerVerification(customerId: string, verified: boolean, attemptsLeft: number) {
    this.sessionVerification.set(customerId, { verified, attemptsLeft });
  }

  public resetVerification(customerId: string) {
    this.sessionVerification.set(customerId, { attemptsLeft: 2, verified: false });
  }

  // --- Idempotency Store ---
  public getIdempotentResult(key: string): any | null {
    return this.idempotencyStore.get(key) || null;
  }

  public setIdempotentResult(key: string, result: any) {
    this.idempotencyStore.set(key, result);
  }

  // --- Writes (Guarded with snapshots) ---

  public addRefund(refund: RefundRow, orderNumber: string) {
    this.createSnapshot(`process_refund_${orderNumber}`);

    // Update refunds.csv
    const refunds = this.getRefunds();
    refunds.push(refund);
    fs.writeFileSync(path.join(DATA_WORK_DIR, 'refunds.csv'), stringifyCsv(refunds));

    // Update orders.csv
    const orders = this.getOrders();
    const targetOrder = orders.find(o => o.order_number === orderNumber);
    if (targetOrder) {
      targetOrder.refund_status = 'refunded';
      fs.writeFileSync(path.join(DATA_WORK_DIR, 'orders.csv'), stringifyCsv(orders));
    }
  }

  public addSupportCase(supportCase: SupportCaseRow) {
    this.createSnapshot(`escalate_case_${supportCase.case_number}`);

    const cases = this.getSupportCases();
    cases.push(supportCase);
    fs.writeFileSync(path.join(DATA_WORK_DIR, 'support_cases.csv'), stringifyCsv(cases));

    // Update customer open_cases count
    const customers = this.getCustomers();
    const cust = customers.find(c => c.customer_id === supportCase.customer_id);
    if (cust) {
      const openCount = (parseInt(cust.open_cases, 10) || 0) + 1;
      cust.open_cases = openCount.toString();
      fs.writeFileSync(path.join(DATA_WORK_DIR, 'customers.csv'), stringifyCsv(customers));
    }
  }

  public saveDraftCase(draft: { reason_code: string; customer_id: string; order_number?: string; summary: string }): string {
    const draftId = `DRAFT-${Date.now()}`;
    const draftFile = path.join(DRAFTS_DIR, `${draftId}.json`);
    const content = {
      draft_id: draftId,
      created_at: new Date().toISOString(),
      ...draft
    };
    fs.writeFileSync(draftFile, JSON.stringify(content, null, 2));
    return draftId;
  }

  // --- Redacted POPIA Audit Logging ---

  public logAudit(entry: AuditLogEntry) {
    const logFile = path.join(AUDIT_DIR, 'audit_trail.jsonl');
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(logFile, line);
  }

  public getAuditLogs(): AuditLogEntry[] {
    const logFile = path.join(AUDIT_DIR, 'audit_trail.jsonl');
    if (!fs.existsSync(logFile)) return [];
    const lines = fs.readFileSync(logFile, 'utf-8').trim().split('\n');
    return lines.filter(Boolean).map(l => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    }).filter(Boolean) as AuditLogEntry[];
  }
}

export const db = new H9Database();
