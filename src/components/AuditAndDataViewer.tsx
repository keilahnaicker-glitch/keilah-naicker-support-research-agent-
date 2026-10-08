import React, { useState, useEffect } from 'react';
import { AuditLogEntry, PolicyItem } from '../types.ts';
import { Database, ShieldCheck, Download, RefreshCw, FileText, Table, Layers } from 'lucide-react';

interface AuditAndDataViewerProps {
  auditLogs: AuditLogEntry[];
  onRefreshAudit: () => void;
  onResetData: () => void;
  isResetting: boolean;
}

export const AuditAndDataViewer: React.FC<AuditAndDataViewerProps> = ({
  auditLogs,
  onRefreshAudit,
  onResetData,
  isResetting
}) => {
  const [subTab, setSubTab] = useState<'audit' | 'tables' | 'policies'>('audit');
  const [selectedTable, setSelectedTable] = useState<string>('policies');
  const [tableData, setTableData] = useState<any[]>([]);
  const [isLoadingTable, setIsLoadingTable] = useState<boolean>(false);
  const [policies, setPolicies] = useState<PolicyItem[]>([]);

  // Fetch table data when selectedTable changes
  useEffect(() => {
    if (subTab === 'tables') {
      fetchTable(selectedTable);
    }
  }, [selectedTable, subTab]);

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchTable = async (tableName: string) => {
    setIsLoadingTable(true);
    try {
      const res = await fetch(`/api/tables/${tableName}`);
      const data = await res.json();
      setTableData(data.rows || []);
    } catch {
      setTableData([]);
    } finally {
      setIsLoadingTable(false);
    }
  };

  const fetchPolicies = async () => {
    try {
      const res = await fetch('/api/policies');
      const data = await res.json();
      setPolicies(data.policies || []);
    } catch {
      setPolicies([]);
    }
  };

  const exportAuditJson = () => {
    const blob = new Blob([JSON.stringify(auditLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `h9loop_audit_trail_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const exportAuditCsv = () => {
    if (auditLogs.length === 0) return;
    const headers = ['id', 'timestamp', 'customer_id', 'order_number', 'action_type', 'redacted_summary'];
    const rows = auditLogs.map(l => [
      l.id,
      l.timestamp,
      l.customer_id || '',
      l.order_number || '',
      l.action_type,
      `"${l.redacted_summary.replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `h9loop_audit_trail_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Database className="w-5 h-5 text-cyan-400" />
            <span>Audit Trail & Data Store</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            POPIA-sanitized access logs, snapshot backups, and active CSV tables in <code className="text-cyan-400">/data_work/</code>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onResetData}
            disabled={isResetting}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            Reset Data to Original
          </button>
        </div>
      </div>

      {/* Sub tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2 text-xs">
        <button
          onClick={() => setSubTab('audit')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
            subTab === 'audit' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>POPIA Audit Trail ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setSubTab('tables')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
            subTab === 'tables' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Table className="w-3.5 h-3.5" />
          <span>CSV Tables Browser</span>
        </button>

        <button
          onClick={() => setSubTab('policies')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
            subTab === 'policies' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Policies (Source of Truth)</span>
        </button>
      </div>

      {/* 1. POPIA Audit Trail View */}
      {subTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">
              POPIA Rule G8: Audit logs record Customer IDs only, omitting full telephone numbers and plain-text emails.
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onRefreshAudit}
                className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white text-xs border border-slate-700 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
              <button
                onClick={exportAuditJson}
                className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white text-xs border border-slate-700 flex items-center gap-1"
              >
                <Download className="w-3 h-3" /> JSON
              </button>
              <button
                onClick={exportAuditCsv}
                className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white text-xs border border-slate-700 flex items-center gap-1"
              >
                <Download className="w-3 h-3" /> CSV
              </button>
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Action Type</th>
                  <th className="py-2.5 px-3">Customer ID</th>
                  <th className="py-2.5 px-3">Order Number</th>
                  <th className="py-2.5 px-3">Redacted Audit Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 italic">
                      No audit entries recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.slice().reverse().map((entry, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-400">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            entry.action_type === 'REFUND_PROCESSED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : entry.action_type === 'CASE_ESCALATED'
                              ? 'bg-amber-500/20 text-amber-300'
                              : entry.action_type === 'DECISION'
                              ? 'bg-cyan-500/20 text-cyan-300'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {entry.action_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-bold text-slate-200">
                        {entry.customer_id || '—'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-emerald-400">
                        {entry.order_number || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 min-w-[320px]">
                        {entry.redacted_summary}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. CSV Tables Browser View */}
      {subTab === 'tables' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            {['policies', 'customers', 'products', 'orders', 'payments', 'refunds', 'support_cases'].map(t => (
              <button
                key={t}
                onClick={() => setSelectedTable(t)}
                className={`px-3 py-1.5 rounded-lg font-mono transition-colors whitespace-nowrap ${
                  selectedTable === t
                    ? 'bg-slate-800 text-cyan-300 border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t}.csv
              </button>
            ))}
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl overflow-x-auto max-h-[500px]">
            {isLoadingTable ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading table data...</div>
            ) : tableData.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 italic">No records in this table.</div>
            ) : (
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0">
                  <tr>
                    {Object.keys(tableData[0]).map(col => (
                      <th key={col} className="py-2.5 px-3 whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {tableData.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-800/30 transition-colors">
                      {Object.values(row).map((val: any, cIdx) => (
                        <td key={cIdx} className="py-2 px-3 whitespace-nowrap">
                          {String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 3. Policies Source of Truth View */}
      {subTab === 'policies' && (
        <div className="space-y-4">
          <div className="p-3 bg-slate-950/80 border border-emerald-500/30 rounded-lg text-xs text-slate-300">
            <span className="font-semibold text-emerald-400 block mb-1">G10: Single Source of Truth</span>
            Policies loaded dynamically from <code className="text-emerald-300">policies.csv</code>. If any sample
            prompt figure conflicts with an actual policy row, policies.csv governs.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {policies.map(p => (
              <div key={p.policy_id} className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-emerald-400">{p.policy_id}</span>
                  <span className="font-semibold text-slate-200">{p.topic}</span>
                </div>
                <p className="text-slate-300 leading-relaxed">{p.rule_text}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60 font-mono">
                  <span>Threshold: {p.threshold_zar ? `R${parseFloat(p.threshold_zar).toLocaleString('en-ZA')}` : 'None'}</span>
                  <span>Escalates: {p.escalate === '1' ? 'YES' : 'NO'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
