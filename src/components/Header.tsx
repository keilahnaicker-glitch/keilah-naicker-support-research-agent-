import React from 'react';
import { ShieldCheck, Database, FileText, CheckCircle2, RotateCcw, AlertCircle, UserCheck } from 'lucide-react';

interface HeaderProps {
  activeTab: 'chat' | 'tests' | 'audit' | 'mitigations';
  setActiveTab: (tab: 'chat' | 'tests' | 'audit' | 'mitigations') => void;
  isLeadMode: boolean;
  setIsLeadMode: (val: boolean) => void;
  onResetData: () => void;
  isResetting: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isLeadMode,
  setIsLeadMode,
  onResetData,
  isResetting
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 font-black text-xl text-white tracking-wider">
              H9
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-100 tracking-tight">H9loop Support Resolver</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3" /> POPIA Compliant
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                South Africa AI Training & Placement · Source of Truth: <code className="text-emerald-400">policies.csv</code> · Ref Date: 2026-10-05
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            {/* Support Lead Mode Switch */}
            <button
              onClick={() => setIsLeadMode(!isLeadMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                isLeadMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
              title="Toggle Support Lead Reviewer Mode"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Support Lead Mode:</span>
              <span className="font-semibold">{isLeadMode ? 'Active' : 'Off'}</span>
            </button>

            {/* Reset Data Button */}
            <button
              onClick={onResetData}
              disabled={isResetting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
              title="Reset data_work to data_original baseline"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Reset DB</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1 border-t border-slate-800/80 -mb-px overflow-x-auto text-sm">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-3 font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'chat'
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Customer Chat & Agent Loop</span>
          </button>

          <button
            onClick={() => setActiveTab('tests')}
            className={`px-4 py-3 font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'tests'
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Test Runner (14 Benchmark Cases)</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-3 font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4 text-cyan-400" />
            <span>Audit Trail & CSV Data</span>
          </button>

          <button
            onClick={() => setActiveTab('mitigations')}
            className={`px-4 py-3 font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'mitigations'
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>Mitigation Table & Checklist</span>
          </button>
        </div>
      </div>
    </header>
  );
};
