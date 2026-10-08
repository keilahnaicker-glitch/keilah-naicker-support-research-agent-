import React from 'react';
import { ExactCaseBlock } from '../types.ts';
import { ShieldCheck, ShieldAlert, KeyRound, Receipt, AlertCircle, FileText } from 'lucide-react';

interface CaseBlockDisplayProps {
  caseBlock: ExactCaseBlock;
  toolCallCount: number;
}

export const CaseBlockDisplay: React.FC<CaseBlockDisplayProps> = ({ caseBlock, toolCallCount }) => {
  const formatAmount = (amt: number | null) => {
    if (amt === null || amt === undefined) return '—';
    return `R${amt.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-slate-100 tracking-tight">Exact Case Block (Section 5)</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            Calls: {toolCallCount} / 10
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
              caseBlock.verified
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}
          >
            {caseBlock.verified ? (
              <>
                <ShieldCheck className="w-3 h-3" /> Verified
              </>
            ) : (
              <>
                <ShieldAlert className="w-3 h-3" /> Unverified
              </>
            )}
          </span>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 mb-3 italic">
        Persisted and reattached verbatim on every turn. Never compressed or summarized.
      </p>

      <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5 font-sans">Customer ID</span>
          <span className="font-semibold text-slate-200">{caseBlock.customer_id || '—'}</span>
        </div>

        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5 font-sans">Order Number</span>
          <span className="font-semibold text-emerald-400">{caseBlock.order_number || '—'}</span>
        </div>

        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5 font-sans">Product ID</span>
          <span className="font-medium text-slate-300">{caseBlock.product_id || '—'}</span>
        </div>

        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5 font-sans">Amount (ZAR)</span>
          <span className="font-semibold text-amber-300">{formatAmount(caseBlock.amount_zar)}</span>
        </div>

        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5 font-sans">Order Date</span>
          <span className="text-slate-300">{caseBlock.order_date || '—'}</span>
        </div>

        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5 font-sans">Refund Type</span>
          <span className="text-slate-300">{caseBlock.refund_type || '—'}</span>
        </div>

        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5 font-sans">Refund ID</span>
          <span className="font-semibold text-emerald-300">{caseBlock.refund_id || '—'}</span>
        </div>

        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5 font-sans">Case Number</span>
          <span className="font-semibold text-cyan-300">{caseBlock.case_number || '—'}</span>
        </div>

        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 col-span-2 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-sans">Attempts Left (Max 2)</span>
          <span className={`font-semibold ${caseBlock.attempts_left <= 0 ? 'text-rose-400' : 'text-slate-200'}`}>
            {caseBlock.attempts_left} / 2
          </span>
        </div>
      </div>
    </div>
  );
};
