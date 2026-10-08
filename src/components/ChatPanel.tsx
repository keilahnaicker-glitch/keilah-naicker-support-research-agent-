import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types.ts';
import { Send, User, Bot, Sparkles, RefreshCw, AlertCircle, Check, Copy } from 'lucide-react';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  onResetSession: () => void;
  status: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSendMessage,
  isLoading,
  onResetSession,
  status
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const quickScenarios = [
    {
      label: 'C1001 Valid Refund',
      text: 'Hi, I am C1001, email palesa.naidoo1@example.com, phone ending in 7500. I would like a refund for order H9-10159.'
    },
    {
      label: 'C1004 Duplicate Charge',
      text: 'I was charged twice! I am C1004, tendai.mokoena4@example.com, phone 2408. Order H9-10162 has duplicate charges.'
    },
    {
      label: 'C1002 Expired 14 Days',
      text: 'Hello, I am C1002, email riaan.govender2@example.com, phone last 4 digits 1636. Please refund order H9-10160.'
    },
    {
      label: 'C1003 Non-Refundable Pack',
      text: 'Hi, customer C1003 here, ilse.khumalo3@example.com, phone 7533. Need a refund for my purchase H9-10161.'
    },
    {
      label: 'C1005 R25k Hard Limit',
      text: 'Good day, C1005 here, email ruan.zulu5@example.com, phone 2656. I want to cancel and refund order H9-10163 for R25,000.'
    },
    {
      label: 'C1007 Fraud Flagged',
      text: 'I am C1007, email thabo.sithole7@example.com, phone 8115. Refund order H9-10165.'
    },
    {
      label: 'C1010 Missing Course Access',
      text: 'I paid for order H9-10168 but I cannot access my course. I am C1010, sibusiso.williams10@example.com, phone 6695.'
    },
    {
      label: 'C1014 Locked Account',
      text: 'Good day, C1014 here, sipho.molefe14@example.com, phone 3516. I need a refund on H9-10172.'
    }
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col h-full shadow-sm overflow-hidden">
      {/* Chat Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <span>Customer Live Chat</span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                status === 'resolved'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : status === 'awaiting_confirmation'
                  ? 'bg-amber-500/20 text-amber-300'
                  : status === 'escalated'
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              Status: {status}
            </span>
          </h2>
          <p className="text-xs text-slate-400">Strict G1-G10 compliance · Plain English · Max 120 words · ISO Dates</p>
        </div>

        <button
          onClick={onResetSession}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/80 hover:bg-slate-700 transition-colors"
          title="Reset conversation state"
        >
          <RefreshCw className="w-3 h-3" /> New Session
        </button>
      </div>

      {/* Quick Scenario Chips */}
      <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800/60 overflow-x-auto flex gap-1.5 scrollbar-thin">
        <span className="text-[11px] font-medium text-slate-400 self-center whitespace-nowrap mr-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-emerald-400" /> Presets:
        </span>
        {quickScenarios.map((sc, i) => (
          <button
            key={i}
            onClick={() => setInputText(sc.text)}
            className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-emerald-950/40 text-slate-300 hover:text-emerald-300 border border-slate-700 hover:border-emerald-600/40 transition-colors"
          >
            {sc.label}
          </button>
        ))}
      </div>

      {/* Message List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 mx-auto mb-3 flex items-center justify-center text-emerald-400">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-medium text-slate-200 mb-1">H9loop Support Resolver is Ready</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
              Select a seeded persona chip above or ask a refund, access, billing or account question. Before accessing
              records, identity verification is strictly enforced.
            </p>
          </div>
        ) : (
          messages.map(m => {
            const isCustomer = m.role === 'customer';
            const wordCount = m.text.trim().split(/\s+/).length;

            return (
              <div
                key={m.id}
                className={`flex gap-3 ${isCustomer ? 'justify-end' : 'justify-start'}`}
              >
                {!isCustomer && (
                  <div className="w-7 h-7 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 shadow-sm text-xs leading-relaxed ${
                    isCustomer
                      ? 'bg-emerald-600 text-white rounded-br-none'
                      : 'bg-slate-800 border border-slate-700/80 text-slate-100 rounded-bl-none'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1 text-[10px] opacity-75">
                    <span className="font-semibold">{isCustomer ? 'Customer' : 'H9loop Resolver'}</span>
                    <div className="flex items-center gap-1.5">
                      {!isCustomer && (
                        <span
                          className={`px-1.5 py-0.2 rounded font-mono ${
                            wordCount <= 120 ? 'bg-emerald-950/60 text-emerald-300' : 'bg-rose-950/60 text-rose-300'
                          }`}
                        >
                          {wordCount} / 120 words (G9)
                        </span>
                      )}
                      <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <button
                        onClick={() => copyText(m.id, m.text)}
                        className="hover:text-white transition-opacity p-0.5"
                        title="Copy message"
                      >
                        {copiedId === m.id ? <Check className="w-2.5 h-2.5 text-emerald-300" /> : <Copy className="w-2.5 h-2.5" />}
                      </button>
                    </div>
                  </div>

                  <p className="whitespace-pre-wrap">{m.text}</p>
                </div>

                {isCustomer && (
                  <div className="w-7 h-7 rounded-lg bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-200 flex-shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {isLoading && (
          <div className="flex gap-3 justify-start items-center text-xs text-slate-400">
            <div className="w-7 h-7 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-slate-800 border border-slate-700/80 rounded-2xl rounded-bl-none p-3 text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Evaluating policies & executing tools...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Confirmation Bar if awaiting confirmation */}
      {status === 'awaiting_confirmation' && (
        <div className="p-2.5 bg-amber-950/30 border-t border-amber-500/30 flex items-center justify-between text-xs">
          <span className="text-amber-300 font-medium flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> Action required: Explicit customer confirmation (G4)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => onSendMessage('Yes, please proceed with the refund.')}
              className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors"
            >
              Reply "Yes, proceed"
            </button>
            <button
              onClick={() => onSendMessage('No, please cancel the request.')}
              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
            >
              Reply "No, cancel"
            </button>
          </div>
        </div>
      )}

      {/* Chat Input */}
      <form onSubmit={handleSubmit} className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="Type customer reply or command (e.g. 'Yes', or provide verification)..."
          disabled={isLoading}
          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isLoading}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg px-4 flex items-center justify-center transition-colors text-xs font-semibold gap-1.5"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
};
