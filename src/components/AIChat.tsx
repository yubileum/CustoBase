import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../lib/DataContext';
import { Sparkles, Send, Bot, User, Loader2, ChevronDown } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

export default function AIChat() {
  const { tables, fields, charts, addChart, updateChart, data } = useData();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'init', role: 'model', text: 'Hi! I can help you create or update charts. What would you like to visualize? Try "create a bar chart of sales by region".' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const hasAnyData = tables.some(t => t.data.length > 0);

  const handleSend = async () => {
    if (!input.trim() || !hasAnyData) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    const sent = input;
    setInput('');
    setIsTyping(true);

    try {
      // ✅ FIX: pass ALL tables' fields and names to AI context
      const allTablesSummary = tables.map(t => ({
        id: t.id,
        name: t.name,
        fields: t.fields,
        rowCount: t.data.length,
        sample: t.data[0] ?? {},
      }));

      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: sent,
          fields,       // active table fields (legacy compat)
          charts,
          dataSample: data[0] || {},
          allTables: allTablesSummary, // NEW: all tables
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `Request failed (${res.status})`);
      }

      const result = await res.json();
      let responseText: string = result.text || '';
      const functionCalls: any[] = result.functionCalls || [];

      for (const call of functionCalls) {
        if (call.name === 'addChart') {
          const args = call.args ?? {};
          addChart({
            id: crypto.randomUUID(),
            title: args.title,
            type: args.type,
            xAxisField: args.type !== 'Pie' && args.type !== 'Donut' ? args.xAxisField : undefined,
            yAxisField: args.type !== 'Pie' && args.type !== 'Donut' ? args.yAxisField : undefined,
            nameField:  args.type === 'Pie' || args.type === 'Donut' ? args.xAxisField : undefined,
            valueField: args.type === 'Pie' || args.type === 'Donut' ? args.yAxisField : undefined,
            aggregation: args.aggregation,
            colSpan: args.colSpan,
            tableId: args.tableId,
          });
          if (!responseText) responseText = `✓ Added "${args.title}" chart!`;
        } else if (call.name === 'updateChart') {
          const args = call.args ?? {};
          updateChart(args.id, {
            ...(args.title && { title: args.title }),
            ...(args.type  && { type: args.type }),
            ...(args.xAxisField !== undefined && {
              xAxisField: args.type !== 'Pie' ? args.xAxisField : undefined,
              nameField:  args.type === 'Pie' ? args.xAxisField : undefined,
            }),
            ...(args.yAxisField !== undefined && {
              yAxisField: args.type !== 'Pie' ? args.yAxisField : undefined,
              valueField: args.type === 'Pie' ? args.yAxisField : undefined,
            }),
            ...(args.aggregation && { aggregation: args.aggregation }),
            ...(args.colSpan     && { colSpan: args.colSpan }),
          });
          if (!responseText) responseText = '✓ Chart updated!';
        }
      }

      setMessages(prev => [...prev, {
        id: Date.now().toString(), role: 'model',
        text: responseText || "Done! Let me know if you'd like any adjustments.",
      }]);
    } catch (error: any) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(), role: 'model',
        text: `Error: ${error.message || 'Something went wrong.'}`,
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 40,
          width: 52, height: 52, borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
          transition: 'all 200ms',
          transform: isOpen ? 'scale(0) rotate(90deg)' : 'scale(1) rotate(0deg)',
          opacity: isOpen ? 0 : 1,
          pointerEvents: isOpen ? 'none' : 'auto',
        }}
        title="AI Assistant"
      >
        <Sparkles size={20} color="white" />
      </button>

      {/* Panel */}
      <div
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 50,
          width: 360, borderRadius: 16,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-base)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column',
          height: 520, maxHeight: 'calc(100vh - 48px)',
          transition: 'all 250ms cubic-bezier(0.4,0,0.2,1)',
          transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(20px)',
          opacity: isOpen ? 1 : 0,
          transformOrigin: 'bottom right',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--border-base)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))',
          borderRadius: '16px 16px 0 0', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={14} color="white" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>AI Assistant</p>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>Powered by Gemini</p>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={() => setIsOpen(false)}>
            <ChevronDown size={16} />
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg-surface2)' }}>
          {!hasAnyData && (
            <div style={{ padding: '10px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--color-warning)' }}>
              Connect a data source first so I can help you build charts!
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', gap: 8, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: msg.role === 'user' ? 'rgba(59,130,246,0.15)' : 'rgba(99,102,241,0.15)',
              }}>
                {msg.role === 'user'
                  ? <User size={13} style={{ color: 'var(--color-info)' }} />
                  : <Bot size={13} style={{ color: 'var(--color-accent)' }} />
                }
              </div>
              <div style={{
                maxWidth: '78%', padding: '8px 12px', borderRadius: 12, fontSize: 13, lineHeight: 1.5,
                background: msg.role === 'user' ? 'var(--color-accent)' : 'var(--bg-surface)',
                color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                border: msg.role === 'user' ? 'none' : '1px solid var(--border-base)',
                borderRadius: msg.role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
              }}>
                {msg.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={13} style={{ color: 'var(--color-accent)' }} />
              </div>
              <div style={{ padding: '8px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-base)', borderRadius: '4px 12px 12px 12px' }}>
                <Loader2 size={14} className="animate-spin-slow" style={{ color: 'var(--text-muted)' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '12px', borderTop: '1px solid var(--border-base)', background: 'var(--bg-surface)', borderRadius: '0 0 16px 16px', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={hasAnyData ? 'Ask me to create a chart…' : 'Connect data first'}
              disabled={!hasAnyData || isTyping}
              rows={1}
              style={{
                width: '100%', resize: 'none', borderRadius: 10,
                border: '1px solid var(--border-base)',
                background: 'var(--bg-surface2)',
                color: 'var(--text-primary)',
                padding: '8px 40px 8px 12px',
                fontSize: 13, fontFamily: 'var(--font-sans)',
                outline: 'none', maxHeight: 100, minHeight: 38,
                boxSizing: 'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--color-accent)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border-base)'; }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || !hasAnyData || isTyping}
              style={{
                position: 'absolute', right: 6, bottom: 6,
                width: 28, height: 28, borderRadius: 8,
                background: input.trim() && hasAnyData ? 'var(--color-accent)' : 'var(--border-strong)',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 180ms',
              }}
            >
              <Send size={13} color="white" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
