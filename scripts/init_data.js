/**
 * Initial dataset generator for H9loop Support Resolver.
 * Writes the 7 canonical CSV tables to /h9loop_support/data_original/
 * and initializes /data_work/, /backups/, /drafts/, and /audit_trail/.
 */
import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const DATA_ORIGINAL_DIR = path.join(ROOT_DIR, 'h9loop_support', 'data_original');
const DATA_WORK_DIR = path.join(ROOT_DIR, 'data_work');
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups');
const DRAFTS_DIR = path.join(ROOT_DIR, 'drafts');
const AUDIT_DIR = path.join(ROOT_DIR, 'audit_trail');
const DOCS_DIR = path.join(ROOT_DIR, 'h9loop_support', 'docs');

[DATA_ORIGINAL_DIR, DATA_WORK_DIR, BACKUPS_DIR, DRAFTS_DIR, AUDIT_DIR, DOCS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Policies
const policiesCsv = `policy_id,topic,rule_text,threshold_zar,escalate
POL-01,Refund window,"Refunds allowed within 14 days of order_date. After that, explain policy and escalate only if the customer disputes.",,0
POL-02,Non-refundable,Products with refundable = 0 (Downloadable Prompt Template Pack) cannot be refunded once delivered.,,0
POL-03,Single refund,"Only one refund per order. If refund_status = refunded, do not refund again.",,0
POL-04,Refund approval limit,"Refunds above R5,000 need human approval before processing.",5000.0,1
POL-05,Hard escalation limit,"Refunds above R10,000 must be escalated; the agent must never process them.",10000.0,1
POL-06,Subscriptions,Subscription renewals cannot be reversed after 14 days.,,0
POL-07,Fraud,"If fraud_flag = 1, stop self-service and escalate to the Security queue.",,1
POL-08,Locked or suspended accounts,Do not refund or change data on a locked or suspended account; escalate to Account Recovery.,,1
POL-09,Duplicate charge,"If two settled payments exist for one order, the duplicate may be refunded after verification; if the data conflicts, escalate.",,0
POL-10,Verification,"Before any refund or account change, the customer must give their email and the last 4 digits of their phone number, and both must match the record.",,0
POL-11,Manager request,"If the customer asks for a manager or mentions legal action, escalate immediately.",,1
POL-13,Partial refunds,The agent does not process partial refunds. Escalate partial-refund requests with the amount requested.,,1
POL-12,POPIA,Never reveal another person's data. Share only the verified customer's own record. Never display full phone numbers.,,0`;

// Products
const productsCsv = `product_id,name,category,price_zar,is_digital,is_subscription,refundable
P001,AI Foundations Course,Course,2500.0,1,0,1
P002,Prompt Engineering Bootcamp,Course,4500.0,1,0,1
P003,AI Agents Masterclass,Course,6500.0,1,0,1
P004,Claude Skills Jar Subscription (monthly),Subscription,299.0,1,1,1
P005,Placement Programme (real-project placement),Programme,12000.0,0,0,1
P006,POPIA & AI Compliance Workshop (SMB),Workshop,8500.0,0,0,1
P007,AI Implementation Starter Package (SMB),Consulting,25000.0,0,0,1
P008,1:1 Coaching Session,Coaching,1200.0,0,0,1
P009,Downloadable Prompt Template Pack,Digital download,350.0,1,0,0`;

// Refunds
const refundsCsv = `refund_id,order_number,amount_zar,created_date,status
RF700000,H9-10167,4500.0,2026-10-02,completed`;

// Support cases
const supportCasesCsv = `case_number,customer_id,opened_date,category,status,summary
CS-20000,C1020,2026-08-30,refund,resolved,Mock historical case
CS-20001,C1075,2026-09-29,other,resolved,Mock historical case
CS-20002,C1034,2026-09-17,account,resolved,Mock historical case
CS-20003,C1009,2026-09-06,access,resolved,Mock historical case
CS-20004,C1012,2026-08-26,billing,resolved,Mock historical case
CS-20005,C1030,2026-09-07,other,resolved,Mock historical case
CS-20006,C1039,2026-08-19,account,open,Mock historical case
CS-20007,C1080,2026-09-02,account,open,Mock historical case
CS-20008,C1014,2026-09-11,account,resolved,Mock historical case
CS-20009,C1060,2026-08-18,account,open,Mock historical case
CS-20010,C1074,2026-09-01,billing,resolved,Mock historical case
CS-20011,C1076,2026-08-19,billing,open,Mock historical case
CS-20012,C1066,2026-08-25,access,resolved,Mock historical case
CS-20013,C1029,2026-08-23,account,resolved,Mock historical case
CS-20014,C1016,2026-09-09,account,resolved,Mock historical case
CS-20015,C1062,2026-09-09,billing,open,Mock historical case
CS-20016,C1031,2026-09-23,other,resolved,Mock historical case
CS-20017,C1068,2026-09-10,refund,resolved,Mock historical case
CS-20018,C1045,2026-08-18,refund,open,Mock historical case
CS-20019,C1056,2026-08-27,refund,open,Mock historical case`;

console.log("Writing static tables...");
fs.writeFileSync(path.join(DATA_ORIGINAL_DIR, 'policies.csv'), policiesCsv);
fs.writeFileSync(path.join(DATA_ORIGINAL_DIR, 'products.csv'), productsCsv);
fs.writeFileSync(path.join(DATA_ORIGINAL_DIR, 'refunds.csv'), refundsCsv);
fs.writeFileSync(path.join(DATA_ORIGINAL_DIR, 'support_cases.csv'), supportCasesCsv);
