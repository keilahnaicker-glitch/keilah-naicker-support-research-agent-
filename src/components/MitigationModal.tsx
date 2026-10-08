import React from 'react';
import { CheckCircle2, ShieldCheck, Scale, FileText } from 'lucide-react';

export const MitigationModal: React.FC = () => {
  const checklist = [
    { title: 'Checkable rules', desc: 'Thresholds, testable booleans (fraud_flag, open_cases) and explicit triggers replace vague adjectives.' },
    { title: 'Diagnosed errors', desc: 'Typed errors (validation, not_found, permission, policy, timeout, unavailable) prevent blind retry loops.' },
    { title: 'Exact state', desc: 'Immutable exact case_block preserves IDs, amounts, and dates across turns without compression.' },
    { title: 'Structured outputs', desc: 'Schema-checked record_decision enables code-driven verification and governance.' },
    { title: 'Matching transport', desc: 'In-app CSV functions run directly in the AI Studio web app without fake SQLite or network MCP.' },
    { title: 'Shared configuration', desc: 'policies.csv serves as the single source of truth across all sessions and agent calls.' },
    { title: 'Safe irreversible actions', desc: 'Eligibility check, explicit customer "yes", code-side gates, idempotency key, and snapshots protect monetary writes.' }
  ];

  const mitigations = [
    {
      id: '1',
      mistake: 'Vague',
      fixedWhere: 'G1–G10 and backend checks',
      whyItWorks: 'Thresholds, testable booleans and trigger lists replace adjectives.'
    },
    {
      id: '2',
      mistake: 'Blind retry',
      fixedWhere: 'Section 4',
      whyItWorks: 'Typed errors diagnose failures; only a failed step is retried.'
    },
    {
      id: '3',
      mistake: 'Lossy state',
      fixedWhere: 'Section 5',
      whyItWorks: 'Exact case_block retains IDs and values across turns.'
    },
    {
      id: '4',
      mistake: 'Free text',
      fixedWhere: 'Section 6',
      whyItWorks: 'A schema-checked record can be parsed by code.'
    },
    {
      id: '5',
      mistake: 'Wrong transport',
      fixedWhere: 'Build target / Section 2',
      whyItWorks: 'In-app CSV functions match AI Studio.'
    },
    {
      id: '6',
      mistake: 'Wrong scope',
      fixedWhere: 'G10 / Section 9',
      whyItWorks: 'Shared policy CSV and project instructions govern every session.'
    },
    {
      id: '7',
      mistake: 'Irreversible action',
      fixedWhere: 'G4 / Sections 3 and 7',
      whyItWorks: 'Eligibility, consent, code-side recheck, backup and idempotency gate writes.'
    }
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
      <div className="pb-4 border-b border-slate-800">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Scale className="w-5 h-5 text-amber-400" />
          <span>Seven-Mistakes Checklist & Mitigation Architecture</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Explicit alignment with the H9loop Support Resolver specification and course exercise standards.
        </p>
      </div>

      {/* Checklist */}
      <div className="bg-slate-950/70 border border-slate-800 p-5 rounded-xl">
        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          <span>Seven-Mistakes Checklist: All Items Enforced (100% Complete)</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {checklist.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-xs text-slate-200 block">{item.title}</span>
                <span className="text-[11px] text-slate-400">{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mitigation Table */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 bg-slate-900/40">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>Section 4 Mitigation Table</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-mono">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Common Mistake</th>
                <th className="py-3 px-4">Fixed Where</th>
                <th className="py-3 px-4">Why It Works</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {mitigations.map(m => (
                <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-400">{m.id}</td>
                  <td className="py-3 px-4 font-semibold text-amber-300">{m.mistake}</td>
                  <td className="py-3 px-4 font-mono text-cyan-300">{m.fixedWhere}</td>
                  <td className="py-3 px-4 text-slate-300">{m.whyItWorks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
