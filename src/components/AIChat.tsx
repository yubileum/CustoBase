import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../lib/DataContext';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { Sparkles, Send, Bot, User, Loader2, X, MessageSquare } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

export default function AIChat() {
  const { fields, charts, addChart, updateChart, data } = useData();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'initial', role: 'model', text: 'Hi! I can help you create or update charts and scorecards. What would you like to visualize?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || !data.length) return;

    const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const addChartDeclaration: FunctionDeclaration = {
        name: 'addChart',
        description: 'Add a new chart to the dashboard.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'The title of the chart.' },
            type: { 
              type: Type.STRING, 
              description: 'The type of chart. Allowed values: Bar, Line, Pie, Scatter, Table, Card' 
            },
            xAxisField: { type: Type.STRING, description: 'The field for the X-axis (or name field for Pie). Ignore for Card.' },
            yAxisField: { type: Type.STRING, description: 'The field for the Y-axis (or value field for Pie/Card).' },
            aggregation: {
              type: Type.STRING,
              description: 'The aggregation type for Pie or Card. Allowed values: sum, count, avg, max, min. Defaults to sum.'
            },
            colSpan: {
              type: Type.NUMBER,
              description: 'Grid column span (1, 2, or 3). 1 is 1/3 width, 3 is full width. Defaults to 1.'
            }
          },
          required: ['title', 'type']
        }
      };

      const updateChartDeclaration: FunctionDeclaration = {
        name: 'updateChart',
        description: 'Update an existing chart on the dashboard.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: 'The ID of the chart to update.' },
            title: { type: Type.STRING, description: 'The title of the chart.' },
            type: { 
              type: Type.STRING, 
              description: 'The type of chart. Allowed values: Bar, Line, Pie, Scatter, Table, Card' 
            },
            xAxisField: { type: Type.STRING, description: 'The field for the X-axis (or name field for Pie). Ignore for Card.' },
            yAxisField: { type: Type.STRING, description: 'The field for the Y-axis (or value field for Pie/Card).' },
            aggregation: {
              type: Type.STRING,
              description: 'The aggregation type for Pie or Card. Allowed values: sum, count, avg, max, min.'
            },
            colSpan: {
              type: Type.NUMBER,
              description: 'Grid column span (1, 2, or 3). 1 is 1/3 width, 3 is full width.'
            }
          },
          required: ['id']
        }
      };

      const systemInstruction = `
        You are a data visualization assistant.
        Available data fields: ${fields.join(', ')}.
        Data Sample (first row): ${JSON.stringify(data[0] || {}, null, 2)}.
        Current charts on dashboard: ${JSON.stringify(charts, null, 2)}.
        When asked to create or modify a chart, use the provided tools.
        Respond with a brief, friendly confirmation summarizing what you did or explaining if you need more info.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: input,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: [addChartDeclaration, updateChartDeclaration] }],
          temperature: 0.2
        }
      });

      let responseText = response.text || '';
      
      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        for (const call of functionCalls) {
          if (call.name === 'addChart') {
            const args = call.args as any;
            addChart({
              id: crypto.randomUUID(),
              title: args.title,
              type: args.type,
              xAxisField: args.xAxisField,
              yAxisField: args.yAxisField,
              nameField: args.type === 'Pie' ? args.xAxisField : undefined,
              valueField: args.type === 'Pie' ? args.yAxisField : undefined,
              aggregation: args.aggregation,
              colSpan: args.colSpan
            });
            if (!responseText) responseText = `I've added the ${args.title} chart for you!`;
          } else if (call.name === 'updateChart') {
            const args = call.args as any;
            updateChart(args.id, {
              ...(args.title && { title: args.title }),
              ...(args.type && { type: args.type }),
              ...(args.xAxisField && { 
                xAxisField: args.type !== 'Pie' ? args.xAxisField : undefined,
                nameField: args.type === 'Pie' ? args.xAxisField : undefined 
              }),
              ...(args.yAxisField && { 
                yAxisField: args.type !== 'Pie' ? args.yAxisField : undefined,
                valueField: args.type === 'Pie' ? args.yAxisField : undefined 
              }),
              ...(args.aggregation && { aggregation: args.aggregation }),
              ...(args.colSpan && { colSpan: args.colSpan })
            });
            if (!responseText) responseText = `I've updated the chart.`;
          }
        }
      }

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: responseText || "I couldn't process that request."
      }]);

    } catch (error: any) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: 'Sorry, I encountered an error trying to process your request.'
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
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      <div className={`absolute bottom-6 right-6 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 transition-all duration-300 transform origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'}`} style={{ height: '600px', maxHeight: 'calc(100vh - 48px)' }}>
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
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'
              }`}>
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-sm' 
                  : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
              }`}>
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
              placeholder={data.length ? "Ask me to create a chart..." : "Connect data first"}
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
