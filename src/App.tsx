/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { ChatPanel } from './components/ChatPanel.tsx';
import { CaseBlockDisplay } from './components/CaseBlockDisplay.tsx';
import { ToolDecisionInspector } from './components/ToolDecisionInspector.tsx';
import { TestRunnerPanel } from './components/TestRunnerPanel.tsx';
import { AuditAndDataViewer } from './components/AuditAndDataViewer.tsx';
import { MitigationModal } from './components/MitigationModal.tsx';
import {
  ChatMessage,
  ExactCaseBlock,
  DecisionRecord,
  AgentStepTrace,
  AuditLogEntry,
  TestCaseResult
} from './types.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'tests' | 'audit' | 'mitigations'>('chat');
  const [sessionId, setSessionId] = useState<string>(() => `sess_${Date.now()}`);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [caseBlock, setCaseBlock] = useState<ExactCaseBlock>({
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
  });
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [traces, setTraces] = useState<AgentStepTrace[]>([]);
  const [toolCallCount, setToolCallCount] = useState<number>(0);
  const [sessionStatus, setSessionStatus] = useState<string>('active');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLeadMode, setIsLeadMode] = useState<boolean>(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Test Runner State
  const [testResults, setTestResults] = useState<TestCaseResult[] | null>(null);
  const [isRunningAllTests, setIsRunningAllTests] = useState<boolean>(false);
  const [fcrRate, setFcrRate] = useState<number>(100);
  const [targetMet, setTargetMet] = useState<boolean>(true);

  // Data reset state
  const [isResettingData, setIsResettingData] = useState<boolean>(false);

  // Initial load
  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/audit');
      const data = await res.json();
      setAuditLogs(data.logs || []);
    } catch {
      // ignore
    }
  };

  const handleSendMessage = async (text: string) => {
    setIsLoading(true);

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'customer',
      text,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          message: text
        })
      });

      const data = await res.json();

      if (res.ok) {
        const assistantMsg: ChatMessage = {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          text: data.reply,
          timestamp: new Date().toISOString(),
          decision: data.decision
        };
        setMessages(prev => [...prev, assistantMsg]);

        if (data.case_block) setCaseBlock(data.case_block);
        if (data.decision) setDecisions(prev => [...prev, data.decision]);
        if (data.traces) {
          setTraces(data.traces);
          const toolCalls = data.traces.filter((t: any) => t.type === 'TOOL_CALL').length;
          setToolCallCount(toolCalls);
        }
        if (data.status) setSessionStatus(data.status);

        fetchAuditLogs();
      } else {
        const errorMsg: ChatMessage = {
          id: `msg_${Date.now()}_err`,
          role: 'assistant',
          text: `Error processing request: ${data.error || 'Unknown error'}. Please try again.`,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `msg_${Date.now()}_err`,
        role: 'assistant',
        text: `Network failure: ${err.message}. Please check your connection.`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSession = async () => {
    const newSessId = `sess_${Date.now()}`;
    setSessionId(newSessId);
    setMessages([]);
    setCaseBlock({
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
    });
    setDecisions([]);
    setTraces([]);
    setToolCallCount(0);
    setSessionStatus('active');
  };

  const handleResetDatabase = async () => {
    setIsResettingData(true);
    try {
      const res = await fetch('/api/reset_data', { method: 'POST' });
      if (res.ok) {
        await handleResetSession();
        await fetchAuditLogs();
      }
    } catch {
      // ignore
    } finally {
      setIsResettingData(false);
    }
  };

  const handleRunAllTests = async () => {
    setIsRunningAllTests(true);
    try {
      const res = await fetch('/api/test_runner/run_all', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setTestResults(data.results || []);
        setFcrRate(data.fcr_rate_percentage ?? 100);
        setTargetMet(data.target_met ?? true);
        fetchAuditLogs();
      }
    } catch (err: any) {
      console.error('Test run failed', err);
    } finally {
      setIsRunningAllTests(false);
    }
  };

  const handleRunSingleTest = async (testId: string): Promise<TestCaseResult | null> => {
    try {
      const res = await fetch('/api/test_runner/run_single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_id: testId })
      });
      const data = await res.json();
      if (res.ok && data.result) {
        setTestResults(prev => {
          if (!prev) return [data.result];
          return prev.map(t => (t.test_id === testId ? data.result : t));
        });
        fetchAuditLogs();
        return data.result;
      }
    } catch {
      // ignore
    }
    return null;
  };

  const handleDirectToolCall = async (toolName: string, args: Record<string, any>) => {
    try {
      const res = await fetch('/api/tools/direct_call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool_name: toolName,
          args,
          session_id: sessionId
        })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.case_block) setCaseBlock(data.case_block);
        // Refresh session
        const sessRes = await fetch(`/api/session/${sessionId}`);
        const sessData = await sessRes.json();
        if (sessData) {
          setTraces(sessData.traces || []);
          setDecisions(sessData.decisions || []);
          const toolCalls = (sessData.traces || []).filter((t: any) => t.type === 'TOOL_CALL').length;
          setToolCallCount(toolCalls);
        }
        fetchAuditLogs();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isLeadMode={isLeadMode}
        setIsLeadMode={setIsLeadMode}
        onResetData={handleResetDatabase}
        isResetting={isResettingData}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'chat' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start h-[calc(100vh-140px)]">
            {/* Left Column: Live Customer Chat */}
            <div className="lg:col-span-7 h-full">
              <ChatPanel
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                onResetSession={handleResetSession}
                status={sessionStatus}
              />
            </div>

            {/* Right Column: Case Block & Tool Decisions */}
            <div className="lg:col-span-5 h-full flex flex-col gap-6 overflow-y-auto pr-1">
              <CaseBlockDisplay
                caseBlock={caseBlock}
                toolCallCount={toolCallCount}
              />

              <div className="flex-1 min-h-[360px]">
                <ToolDecisionInspector
                  traces={traces}
                  decisions={decisions}
                  isLeadMode={isLeadMode}
                  onDirectToolCall={handleDirectToolCall}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tests' && (
          <TestRunnerPanel
            testResults={testResults}
            isRunningAll={isRunningAllTests}
            onRunAll={handleRunAllTests}
            onRunSingle={handleRunSingleTest}
            fcrRate={fcrRate}
            targetMet={targetMet}
          />
        )}

        {activeTab === 'audit' && (
          <AuditAndDataViewer
            auditLogs={auditLogs}
            onRefreshAudit={fetchAuditLogs}
            onResetData={handleResetDatabase}
            isResetting={isResettingData}
          />
        )}

        {activeTab === 'mitigations' && (
          <MitigationModal />
        )}
      </main>
    </div>
  );
}
