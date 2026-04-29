import 'dotenv/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { GoogleGenAI, Type, type FunctionDeclaration } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

// Support corporate HTTP proxies (e.g. PwC network)
import { setGlobalDispatcher, ProxyAgent } from 'undici';
const httpsProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (httpsProxy) {
  setGlobalDispatcher(new ProxyAgent(httpsProxy));
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function isUrlAllowed(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return false;
    const h = u.hostname;
    if (h === 'localhost' || h.endsWith('.local') || h === '0.0.0.0') return false;
    if (/^127\./.test(h)) return false;
    if (/^10\./.test(h)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
    if (/^192\.168\./.test(h)) return false;
    return true;
  } catch {
    return false;
  }
}

function apiPlugin() {
  return {
    name: 'api-routes',
    configureServer(server: any) {
      server.middlewares.use('/api/proxy-csv', (req: any, res: any, next: any) => {
        if (req.method !== 'GET') { next(); return; }
        (async () => {
          const urlParam = new URL(req.url!, 'http://localhost').searchParams.get('url') ?? '';
          if (!urlParam) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Missing url parameter' }));
          }
          if (!isUrlAllowed(urlParam)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'URL not allowed. Only public HTTPS URLs are supported.' }));
          }
          const upstream = await fetch(urlParam);
          if (!upstream.ok) {
            const status = upstream.status;
            res.writeHead(status, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              error: status >= 400 && status < 500
                ? `Access denied (HTTP ${status}). For Google Sheets, set "General access" to "Anyone with the link".`
                : `Upstream error: ${status} ${upstream.statusText}`,
            }));
          }
          const text = await upstream.text();
          res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8' });
          res.end(text);
        })().catch((err: any) => {
          console.error('Proxy error:', err);
          // Provide a helpful message when the corporate network blocks the host
          const isNotFound = err.code === 'ENOTFOUND' || (err.cause && err.cause.code === 'ENOTFOUND');
          let errorMessage = err.message || 'Failed to fetch data via proxy';
          if (isNotFound) {
            try {
              const hostname = new URL(new URL(req.url!, 'http://localhost').searchParams.get('url') ?? '').hostname;
              errorMessage = `Cannot reach ${hostname}. If you're on a corporate network, set HTTPS_PROXY in your .env file.`;
            } catch {
              errorMessage = `Cannot reach the upstream host. If you're on a corporate network, set HTTPS_PROXY in your .env file.`;
            }
          }
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: errorMessage }));
        });
      });

      server.middlewares.use('/api/proxy-file', (req: any, res: any, next: any) => {
        if (req.method !== 'GET') { next(); return; }
        (async () => {
          const urlParam = new URL(req.url!, 'http://localhost').searchParams.get('url') ?? '';
          if (!urlParam) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Missing url parameter' }));
          }
          if (!isUrlAllowed(urlParam)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'URL not allowed.' }));
          }
          const upstream = await fetch(urlParam);
          if (!upstream.ok) {
            res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: `Upstream error: ${upstream.status}` }));
          }
          const arrayBuffer = await upstream.arrayBuffer();
          res.writeHead(200, {
            'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream'
          });
          res.end(Buffer.from(arrayBuffer));
        })().catch((err: any) => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message || 'Proxy error' }));
        });
      });

      server.middlewares.use('/api/ai-chat', (req: any, res: any, next: any) => {
        if (req.method !== 'POST') { next(); return; }
        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', () => {
          (async () => {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ error: 'AI not configured. Add GEMINI_API_KEY to your .env file.' }));
            }
            const { message, fields, charts, dataSample, allTables } = JSON.parse(body);
            if (!message || typeof message !== 'string') {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ error: '"message" is required' }));
            }

            const ai = new GoogleGenAI({ apiKey });
            const functionDeclarations: FunctionDeclaration[] = [
              {
                name: 'addChart',
                description: 'Add a new chart to the dashboard.',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: 'Chart title.' },
                    type: { type: Type.STRING, description: 'Chart type: Bar, Line, Pie, Scatter, Table, or Card.' },
                    xAxisField: { type: Type.STRING, description: 'X-axis field (or name field for Pie). Omit for Card.' },
                    yAxisField: { type: Type.STRING, description: 'Y-axis / value / metric field.' },
                    aggregation: { type: Type.STRING, description: 'Aggregation: sum, count, avg, max, min. Default: sum.' },
                    colSpan: { type: Type.NUMBER, description: 'Grid width: 1 (1/3), 2 (2/3), 3 (full). Default: 1.' },
                  },
                  required: ['title', 'type'],
                },
              },
              {
                name: 'updateChart',
                description: 'Update an existing chart on the dashboard.',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING, description: 'ID of the chart to update.' },
                    title: { type: Type.STRING },
                    type: { type: Type.STRING, description: 'Chart type: Bar, Line, Pie, Scatter, Table, or Card.' },
                    xAxisField: { type: Type.STRING },
                    yAxisField: { type: Type.STRING },
                    aggregation: { type: Type.STRING },
                    colSpan: { type: Type.NUMBER },
                  },
                  required: ['id'],
                },
              },
            ];

            const systemInstruction = `You are a data visualization assistant.
Available fields: ${Array.isArray(fields) ? fields.join(', ') : 'none'}.
Data sample (first row): ${JSON.stringify(dataSample ?? {})}.
Current charts: ${JSON.stringify(charts ?? [])}.
Use the provided tools to create or modify charts. Respond briefly and confirm what you did.`;

            const response = await ai.models.generateContent({
              model: 'gemini-1.5-flash',
              contents: message,
              config: {
                systemInstruction,
                tools: [{ functionDeclarations }],
                temperature: 0.2,
              },
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              text: response.text ?? '',
              functionCalls: response.functionCalls ?? [],
            }));
          })().catch((err: any) => {
            console.error('AI error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message || 'AI request failed' }));
          });
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiPlugin()],
  resolve: {
    alias: {
      '@': __dirname,
    },
  },
  server: {
    port: 3000,
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
