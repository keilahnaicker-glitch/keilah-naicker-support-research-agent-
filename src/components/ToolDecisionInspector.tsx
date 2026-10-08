import React, { useState } from 'react';
import { AgentStepTrace, DecisionRecord } from '../types.ts';
import { Wrench, CheckCircle, AlertTriangle, Scale, ChevronDown, ChevronRight, Play } from 'lucide-react';

interface ToolDecisionInspectorProps {
  traces: AgentStepTrace[];
  decisions: DecisionRecord[];
  isLeadMode: boolean;
  onDirectToolCall?: (toolName: string, args: Record<string, any>) => void;
}

export const ToolDecisionInspector: React.FC<ToolDecisionInspectorProps> = ({
  traces,
  decisions,
  isLeadMode,
  onDirectToolCall
}) => {
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});
  const [selectedLeadTool, setSelectedLeadTool] = useState<string>('lookup_order');
  const [leadToolArgsJson, setLeadToolArgsJson] = useState<string>('{\n  "order_number": "H9-10159"\n}');

  const toggleStep = (stepNum: number) => {
    setExpandedSteps(prev => ({ ...prev, [stepNum]: !prev[stepNum] }));
  };

  const latestDecision = decisions[decisions.length - 1];

  const handleRunLeadTool = () => {
    if (!onDirectToolCall) return;
    try {
      const parsed = JSON.parse(leadToolArgsJson);
      onDirectToolCall(selectedLeadTool, parsed);
    } catch {
      // invalid json
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-slate-100 tracking-tight">Decisions & Tool Inspector</h3>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {traces.length} steps · {decisions.length} decisions
        </span>
      </div>

      {/* Latest Decision Card */}
      {latestDecision && (
        <div className="mb-4 p-3 rounded-lg bg-slate-950/80 border border-cyan-500/30 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400">Latest Schema Decision</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                latestDecision.action === 'process_refund'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : latestDecision.action === 'escalate'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : latestDecision.action === 'decline'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {latestDecision.action}
            </span>
          </div>

          <div className="space-y-1 font-mono text-[11px] text-slate-300">
            <div>
              <span className="text-slate-400">Rule IDs: </span>
              {latestDecision.rule_ids.map(r => (
                <span key={r} className="inline-block px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 mr-1 text-[10px]">
                  {r}
                </span>
              ))}
            </div>
            {latestDecision.reason_code && (
              <div>
                <span className="text-slate-400">Reason: </span>
                <span className="text-slate-200">{latestDecision.reason_code}</span>
              </div>
            )}
            <div>
              <span className="text-slate-400">Human Approval Required: </span>
              <span className={latestDecision.needs_human_approval ? 'text-amber-400 font-semibold' : 'text-emerald-400'}>
                {latestDecision.needs_human_approval ? 'YES (Escalated)' : 'NO (Autonomous)'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Support Lead Tool Invoker (if mode active) */}
      {isLeadMode && onDirectToolCall && (
        <div className="mb-4 p-3 bg-amber-950/20 border border-amber-500/30 rounded-lg text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-amber-300 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5" /> Support Lead Direct Tool Invoker
            </span>
          </div>
          <div className="space-y-2">
            <select
              value={selectedLeadTool}
              onChange={e => {
                const val = e.target.value;
                setSelectedLeadTool(val);
                if (val === 'verify_identity') {
                  setLeadToolArgsJson('{\n  "customer_id": "C1001",\n  "email": "palesa.naidoo1@example.com",\n  "phone_last4": "7500"\n}');
                } else if (val === 'get_customer') {
                  setLeadToolArgsJson('{\n  "customer_id": "C1001"\n}');
                } else if (val === 'lookup_order') {
                  setLeadToolArgsJson('{\n  "order_number": "H9-10159"\n}');
                } else if (val === 'check_refund_eligibility') {
                  setLeadToolArgsJson('{\n  "order_number": "H9-10159",\n  "refund_type": "order"\n}');
                } else if (val === 'process_refund') {
                  setLeadToolArgsJson('{\n  "order_number": "H9-10159",\n  "refund_type": "order",\n  "idempotency_key": "H9-10159:order"\n}');
                } else if (val === 'escalate_to_human') {
                  setLeadToolArgsJson('{\n  "reason_code": "MANUAL_LEAD_REVIEW",\n  "customer_id": "C1001",\n  "summary": "Lead inspection request"\n}');
                }
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
            >
              <option value="verify_identity">verify_identity</option>
              <option value="get_customer">get_customer</option>
              <option value="lookup_order">lookup_order</option>
              <option value="check_refund_eligibility">check_refund_eligibility</option>
              <option value="process_refund">process_refund</option>
              <option value="escalate_to_human">escalate_to_human</option>
            </select>
            <textarea
              rows={3}
              value={leadToolArgsJson}
              onChange={e => setLeadToolArgsJson(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 font-mono text-[11px] text-slate-200"
            />
            <button
              onClick={handleRunLeadTool}
              className="w-full py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Play className="w-3 h-3" /> Execute Tool Call
            </button>
          </div>
        </div>
      )}

      {/* Traces Timeline */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[420px]">
        {traces.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs italic">
            No agent actions recorded yet. Start a conversation to view the live execution trace.
          </div>
        ) : (
          traces.map(trace => {
            const isExpanded = !!expandedSteps[trace.step_number];
            return (
              <div
                key={trace.step_number}
                className="bg-slate-950/70 border border-slate-800 rounded-lg overflow-hidden text-xs"
              >
                <div
                  onClick={() => toggleStep(trace.step_number)}
                  className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {trace.type === 'TOOL_CALL' && <Wrench className="w-3.5 h-3.5 text-cyan-400" />}
                    {trace.type === 'DECISION' && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                    {trace.type === 'ERROR' && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
                    <span className="font-semibold text-slate-200">
                      Step #{trace.step_number}: {trace.type === 'TOOL_CALL' ? trace.tool_name : trace.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(trace.timestamp).toLocaleTimeString()}
                    </span>
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-2.5 pt-0 border-t border-slate-800/60 font-mono text-[11px] space-y-2">
                    {trace.tool_args && (
                      <div>
                        <div className="text-[10px] uppercase font-sans text-slate-400 mb-0.5">Parameters:</div>
                        <pre className="bg-slate-900 p-2 rounded text-slate-300 overflow-x-auto text-[10px]">
                          {JSON.stringify(trace.tool_args, null, 2)}
                        </pre>
                      </div>
                    )}

                    {trace.tool_result && (
                      <div>
                        <div className="text-[10px] uppercase font-sans text-slate-400 mb-0.5">Result:</div>
                        <pre className="bg-slate-900 p-2 rounded text-emerald-300 overflow-x-auto text-[10px]">
                          {JSON.stringify(trace.tool_result, null, 2)}
                        </pre>
                      </div>
                    )}

                    {trace.decision && (
                      <div>
                        <div className="text-[10px] uppercase font-sans text-slate-400 mb-0.5">Decision Schema:</div>
                        <pre className="bg-slate-900 p-2 rounded text-cyan-300 overflow-x-auto text-[10px]">
                          {JSON.stringify(trace.decision, null, 2)}
                        </pre>
                      </div>
                    )}

                    {trace.error && (
                      <div>
                        <div className="text-[10px] uppercase font-sans text-rose-400 mb-0.5">Structured Error:</div>
                        <pre className="bg-rose-950/30 border border-rose-800/40 p-2 rounded text-rose-300 overflow-x-auto text-[10px]">
                          {JSON.stringify(trace.error, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
