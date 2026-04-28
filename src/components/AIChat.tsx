import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../lib/DataContext';
import { Sparkles, Send, Bot, User, Loader2, X, MessageSquare } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

export default function AIChat() {
  const { fields, charts, addChart, updateChart, data } = useData();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'initial', role: 'model', text: 'Hi! I can help you create or update charts. What would you like to visualize?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || !data.length) return;

    const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    const sentInput = input;
    setInput('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: sentInput,
          fields,
          charts,
          dataSample: data[0] || {},
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
            xAxisField: args.type !== 'Pie' ? args.xAxisField : undefined,
            yAxisField: args.type !== 'Pie' ? args.yAxisField : undefined,
            nameField:  args.type === 'Pie' ? args.xAxisField : undefined,
            valueField: args.type === 'Pie' ? args.yAxisField : undefined,
            aggregation: args.aggregation,
            colSpan: args.colSpan,
          });
          if (!responseText) responseText = `Added "${args.title}" chart!`;
        } else if (call.name === 'updateChart') {
          const args = call.args ?? {};
          updateChart(args.id, {
            ...(args.title      && { title: args.title }),
            ...(args.type       && { type: args.type }),
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
          if (!responseText) responseText = 'Chart updated!';
        }
      }

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: responseText || "Done! Let me know if you'd like any changes.",
      }]);
    } catch (error: any) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: `Error: ${error.message || 'Something went wrong. Please try again.'}`,
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`absolute bottom-6 right-6 p-4 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all hover:scale-105 z-40 flex items-center justify-center ${isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}
        title="Open AI Assistant"
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      <div
        className={`absolute bottom-6 right-6 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 transition-all duration-300 transform origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'}`}
        style={{ height: '600px', maxHeight: 'calc(100vh - 48px)' }}
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <span className="font-semibold text-gray-800">AI Assistant</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar bg-gray-50/50">
          {!data.length && (
            <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md border border-amber-200">
              Please connect a data source first so I can help you build charts!
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'}`}>
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'}`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-indigo-100 text-indigo-600">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white border border-gray-200 shadow-sm px-4 py-2.5 rounded-2xl rounded-tl-sm flex items-center gap-1">
                <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-gray-100 bg-white rounded-b-2xl shrink-0">
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={data.length ? 'Ask me to create a chart…' : 'Connect data first'}
              disabled={!data.length || isTyping}
              className="w-full resize-none rounded-xl border border-gray-300 pr-10 pl-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-gray-50 block max-h-32 min-h-[44px] custom-scrollbar"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || !data.length || isTyping}
              className="absolute right-2 bottom-2 p-1.5 bg-indigo-600 text-white rounded-lg disabled:opacity-50 disabled:bg-gray-300 transition-colors hover:bg-indigo-700"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
