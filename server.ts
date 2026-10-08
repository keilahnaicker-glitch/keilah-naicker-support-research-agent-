/**
 * Express Server Entry Point for H9loop Support Resolver.
 * Full-stack architecture hosting API proxy endpoints and Vite dev middleware.
 */
import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { db } from './src/server/db.ts';
import {
  getOrCreateSession,
  resetSession,
  processCustomerMessage,
  executeTool
} from './src/server/agent.ts';
import { runAllTests, runSingleTest, SEEDED_TEST_CASES } from './src/server/test_runner.ts';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize database from original data if needed
db.ensureDirectories();

// --- API Endpoints ---

// 1. Chat Interaction Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, session_id } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const activeSessionId = session_id || `sess_${Date.now()}`;
    const result = await processCustomerMessage(activeSessionId, message);

    res.json({
      session_id: activeSessionId,
      ...result
    });
  } catch (err: any) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 2. Session Inspector
app.get('/api/session/:id', (req, res) => {
  const session = getOrCreateSession(req.params.id);
  res.json(session);
});

// 3. Reset Session
app.post('/api/session/reset', (req, res) => {
  const { session_id } = req.body;
  if (!session_id) {
    return res.status(400).json({ error: 'session_id is required.' });
  }
  const session = resetSession(session_id);
  res.json({ status: 'reset', session });
});

// 4. Policies (Source of Truth)
app.get('/api/policies', (req, res) => {
  try {
    const policies = db.getPolicies();
    res.json({ policies, count: policies.length, version: '2026.10' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. CSV Tables Inspector
app.get('/api/tables/:tableName', (req, res) => {
  const { tableName } = req.params;
  try {
    switch (tableName) {
      case 'customers':
        return res.json({ rows: db.getCustomers() });
      case 'products':
        return res.json({ rows: db.getProducts() });
      case 'orders':
        return res.json({ rows: db.getOrders() });
      case 'payments':
        return res.json({ rows: db.getPayments() });
      case 'refunds':
        return res.json({ rows: db.getRefunds() });
      case 'support_cases':
        return res.json({ rows: db.getSupportCases() });
      case 'policies':
        return res.json({ rows: db.getPolicies() });
      default:
        return res.status(404).json({ error: `Table '${tableName}' not found.` });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. POPIA-Redacted Audit Logs
app.get('/api/audit', (req, res) => {
  try {
    const logs = db.getAuditLogs();
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Reset Working Data
app.post('/api/reset_data', (req, res) => {
  try {
    db.resetToOriginal();
    res.json({ status: 'success', message: 'Database reset to original baseline dataset.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Test Runner: Seeded Scenarios List
app.get('/api/test_runner/cases', (req, res) => {
  res.json({ cases: SEEDED_TEST_CASES });
});

// 9. Test Runner: Run All Tests
app.post('/api/test_runner/run_all', async (req, res) => {
  try {
    const testSummary = await runAllTests();
    res.json(testSummary);
  } catch (err: any) {
    console.error('Test runner failure:', err);
    res.status(500).json({ error: err.message });
  }
});

// 10. Test Runner: Run Single Test
app.post('/api/test_runner/run_single', async (req, res) => {
  try {
    const { test_id } = req.body;
    const tc = SEEDED_TEST_CASES.find(c => c.id === test_id);
    if (!tc) {
      return res.status(404).json({ error: `Test case '${test_id}' not found.` });
    }
    const result = await runSingleTest(tc);
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Support Lead Direct Tool Execution
app.post('/api/tools/direct_call', (req, res) => {
  try {
    const { tool_name, args, session_id } = req.body;
    if (!tool_name) {
      return res.status(400).json({ error: 'tool_name is required.' });
    }
    const activeSession = getOrCreateSession(session_id || 'lead_session');
    const outcome = executeTool(tool_name, args || {}, activeSession);
    res.json({
      outcome,
      case_block: activeSession.case_block
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Frontend Serving (Vite in dev, static in prod) ---
async function startServer() {
  if (process.env.NODE_ENV === 'production' && fs.existsSync(path.join(process.cwd(), 'dist'))) {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    // Mount Vite dev server middlewares
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`H9loop Support Resolver server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
