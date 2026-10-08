import React, { useState } from 'react';
import { TestCaseResult } from '../types.ts';
import { Play, CheckCircle2, XCircle, Clock, ShieldCheck, Database, RefreshCw, ChevronDown, ChevronRight, Target } from 'lucide-react';

interface TestRunnerPanelProps {
  testResults: TestCaseResult[] | null;
  isRunningAll: boolean;
  onRunAll: () => void;
  onRunSingle: (testId: string) => Promise<TestCaseResult | null>;
  fcrRate: number;
  targetMet: boolean;
}

export const TestRunnerPanel: React.FC<TestRunnerPanelProps> = ({
  testResults,
  isRunningAll,
  onRunAll,
  onRunSingle,
  fcrRate,
  targetMet
}) => {
  const [expandedTests, setExpandedTests] = useState<Record<string, boolean>>({});
  const [runningSingleId, setRunningSingleId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'resolved' | 'passed' | 'failed'>('all');

  const toggleExpand = (id: string) => {
    setExpandedTests(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRunSingle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRunningSingleId(id);
    await onRunSingle(id);
    setRunningSingleId(null);
  };

  const filteredTests = testResults?.filter(t => {
    if (filter === 'resolved') return t.is_designated_resolved;
    if (filter === 'passed') return t.passed;
    if (filter === 'failed') return !t.passed;
    return true;
  });

  const total = testResults?.length || 14;
  const passed = testResults?.filter(t => t.passed).length || 0;
  const resolvedTotal = testResults?.filter(t => t.is_designated_resolved).length || 6;
  const resolvedPassed = testResults?.filter(t => t.is_designated_resolved && t.passed).length || 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
      {/* Header and Summary Cards */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span>Automated Test Runner</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              14 Seeded Benchmark Cases
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Validates first-contact resolution, policy gates, database state mutations, and POPIA isolation.
          </p>
        </div>

        <button
          onClick={onRunAll}
          disabled={isRunningAll}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all text-xs"
        >
          {isRunningAll ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Running Benchmark Suite...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Run All 14 Test Cases</span>
            </>
          )}
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs font-medium text-slate-400 block mb-1">Total Test Cases</span>
          <span className="text-2xl font-bold text-slate-100">{total}</span>
          <span className="text-[11px] text-slate-500 block mt-1">Seeded deterministic scenarios</span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs font-medium text-slate-400 block mb-1">Passed Overall</span>
          <span className={`text-2xl font-bold ${passed === total ? 'text-emerald-400' : 'text-slate-100'}`}>
            {passed} / {total}
          </span>
          <span className="text-[11px] text-slate-500 block mt-1">Observed actions & DB verified</span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs font-medium text-slate-400 block mb-1">FCR on Resolved Scenarios</span>
          <span className="text-2xl font-bold text-emerald-400">{fcrRate}%</span>
          <span className="text-[11px] text-slate-500 block mt-1">
            {resolvedPassed} of {resolvedTotal} resolved
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs font-medium text-slate-400 block mb-1">Course Target Status</span>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${
                targetMet
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              {targetMet ? 'Target Met (≥ 80%)' : 'Pending Run'}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">First-Contact Resolution benchmark</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-800 text-xs">
        <span className="text-slate-400 mr-1">Filter:</span>
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded-md font-medium transition-colors ${
            filter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All (14)
        </button>
        <button
          onClick={() => setFilter('resolved')}
          className={`px-3 py-1 rounded-md font-medium transition-colors ${
            filter === 'resolved' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Designated Resolved ({resolvedTotal})
        </button>
        <button
          onClick={() => setFilter('passed')}
          className={`px-3 py-1 rounded-md font-medium transition-colors ${
            filter === 'passed' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Passed ({passed})
        </button>
        <button
          onClick={() => setFilter('failed')}
          className={`px-3 py-1 rounded-md font-medium transition-colors ${
            filter === 'failed' ? 'bg-rose-950/40 text-rose-300' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Failed ({total - passed})
        </button>
      </div>

      {/* Test List */}
      <div className="space-y-3">
        {!testResults ? (
          <div className="text-center py-12 bg-slate-950/40 border border-slate-800 rounded-xl">
            <Clock className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <h4 className="text-sm font-medium text-slate-300 mb-1">Tests Not Run Yet</h4>
            <p className="text-xs text-slate-500 mb-4">
              Click "Run All 14 Test Cases" above to execute the automated suite against live CSV tables.
            </p>
            <button
              onClick={onRunAll}
              disabled={isRunningAll}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold"
            >
              Start Automated Test Suite
            </button>
          </div>
        ) : (
          filteredTests?.map(t => {
            const isExpanded = !!expandedTests[t.test_id];
            const isSingleRunning = runningSingleId === t.test_id;

            return (
              <div
                key={t.test_id}
                className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors"
              >
                <div
                  onClick={() => toggleExpand(t.test_id)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    {t.passed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                    )}

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs text-slate-300">{t.test_id}</span>
                        <span className="font-semibold text-xs text-slate-100">{t.scenario_title}</span>
                        {t.is_designated_resolved && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Designated Resolved
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400 font-mono">
                        <span>Order: <strong className="text-slate-300">{t.order_number}</strong></span>
                        <span>Client: <strong className="text-slate-300">{t.customer_id}</strong></span>
                        <span>Action: <strong className="text-cyan-300">{t.observed_action}</strong></span>
                        <span>Duration: {t.duration_ms}ms</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={e => handleRunSingle(t.test_id, e)}
                      disabled={isSingleRunning || isRunningAll}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 transition-colors flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSingleRunning ? 'animate-spin' : ''}`} />
                      Re-run
                    </button>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 pt-0 border-t border-slate-800/80 bg-slate-900/50 space-y-3 text-xs font-mono">
                    {/* Observed Action & Rules */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                        <span className="text-[10px] uppercase font-sans text-slate-400 block mb-1">
                          Observed Decision & Reason
                        </span>
                        <div className="text-cyan-300 font-bold">{t.observed_action}</div>
                        <div className="text-slate-400 text-[11px] mt-0.5">Reason: {t.observed_reason}</div>
                      </div>

                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                        <span className="text-[10px] uppercase font-sans text-slate-400 block mb-1">
                          Database State Verification
                        </span>
                        <div className={t.db_state_verified ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                          {t.db_state_verified ? 'PASSED: CSV mutations validated' : 'FAILED: CSV records mismatch'}
                        </div>
                        <div className="text-slate-400 text-[11px] mt-0.5">
                          Refund Status / Support Cases checked in data_work
                        </div>
                      </div>
                    </div>

                    {/* Exact Case Block Snapshot */}
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <span className="text-[10px] uppercase font-sans text-slate-400 block mb-1">
                        Exact Case Block Snapshot at Closure
                      </span>
                      <pre className="text-slate-300 text-[11px] overflow-x-auto">
                        {JSON.stringify(t.case_block_snapshot, null, 2)}
                      </pre>
                    </div>

                    {/* Turn-by-Turn Evidence */}
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <span className="text-[10px] uppercase font-sans text-slate-400 block mb-2">
                        Turn-by-Turn Evidence Trace
                      </span>
                      <div className="space-y-1.5 font-mono text-[11px]">
                        {t.evidence.map((line, idx) => (
                          <div
                            key={idx}
                            className={`p-1.5 rounded ${
                              line.startsWith('Customer')
                                ? 'bg-slate-900 text-slate-200'
                                : line.startsWith('Assistant')
                                ? 'bg-slate-900/60 text-emerald-300'
                                : line.startsWith('Decision')
                                ? 'bg-cyan-950/40 text-cyan-200'
                                : line.includes('PASSED')
                                ? 'bg-emerald-950/40 text-emerald-400'
                                : line.includes('FAILED')
                                ? 'bg-rose-950/40 text-rose-300'
                                : 'text-slate-400'
                            }`}
                          >
                            {line}
                          </div>
                        ))}
                      </div>
                    </div>
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
