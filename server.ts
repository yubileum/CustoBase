import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

// Block SSRF targets: only allow HTTPS, no RFC-1918 / loopback addresses
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // ── CSV proxy (CORS bypass) ────────────────────────────────────────────────
  app.get('/api/proxy-csv', async (req, res) => {
    const url = req.query.url as string;
    if (!url) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }
    if (!isUrlAllowed(url)) {
      return res.status(400).json({ error: 'URL not allowed. Only public HTTPS URLs are supported.' });
    }

    try {
      const upstream = await fetch(url);
      if (!upstream.ok) {
        const status = upstream.status;
        if (status >= 400 && status < 500) {
          return res.status(status).json({
            error: `Access denied (HTTP ${status}). For Google Sheets, set "General access" to "Anyone with the link".`,
          });
        }
        return res.status(status).json({ error: `Upstream error: ${status} ${upstream.statusText}` });
      }
      const text = await upstream.text();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.send(text);
    } catch (err: any) {
      console.error('Proxy error:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch data via proxy' });
    }
  });

  // ── AI chat (Gemini – server-side, key never reaches the browser) ──────────
  app.post('/api/ai-chat', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'AI not configured. Add GEMINI_API_KEY to your .env file.' });
    }

    const { message, fields, charts, dataSample, allTables } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: '"message" is required' });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });

      const functionDeclarations = [
        {
          name: 'addChart',
          description: 'Add a new chart to the dashboard.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              title:        { type: Type.STRING, description: 'Chart title.' },
              type:         { type: Type.STRING, description: 'Chart type: Bar, Line, Area, Pie, Donut, Scatter, Table, or Card.' },
              xAxisField:   { type: Type.STRING, description: 'X-axis field (or name field for Pie/Donut). Omit for Card.' },
              yAxisField:   { type: Type.STRING, description: 'Y-axis / value / metric field.' },
              aggregation:  { type: Type.STRING, description: 'Aggregation: sum, count, avg, max, min. Default: sum.' },
              colSpan:      { type: Type.NUMBER, description: 'Grid width: 1 (1/3), 2 (2/3), 3 (full). Default: 1.' },
              tableId:      { type: Type.STRING, description: 'ID of the data table to use. Use the id from allTables.' },
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
              id:           { type: Type.STRING, description: 'ID of the chart to update.' },
              title:        { type: Type.STRING },
              type:         { type: Type.STRING, description: 'Chart type: Bar, Line, Area, Pie, Donut, Scatter, Table, or Card.' },
              xAxisField:   { type: Type.STRING },
              yAxisField:   { type: Type.STRING },
              aggregation:  { type: Type.STRING },
              colSpan:      { type: Type.NUMBER },
            },
            required: ['id'],
          },
        },
      ];

      const tablesSummary = Array.isArray(allTables)
        ? allTables.map((t: any) => `Table "${t.name}" (id: ${t.id}): fields [${t.fields?.join(', ')}]`).join('\n')
        : `Active table fields: ${Array.isArray(fields) ? fields.join(', ') : 'none'}`;

      const systemInstruction = `You are a data visualization assistant for CustoBase dashboard.
All available data tables:
${tablesSummary}

Active table sample row: ${JSON.stringify(dataSample ?? {})}.
Current charts on dashboard: ${JSON.stringify(charts ?? [])}.
Use the provided tools to create or modify charts. When the user mentions a specific table by name, use its id in the tableId field.
Respond briefly and confirm what you did.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: message,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations }],
          temperature: 0.2,
        },
      });

      res.json({
        text: response.text ?? '',
        functionCalls: response.functionCalls ?? [],
      });
    } catch (err: any) {
      console.error('AI error:', err);
      res.status(500).json({ error: err.message || 'AI request failed' });
    }
  });

  // ── Vite dev / production static serving ──────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const [{ default: react }, { default: tailwindcss }] = await Promise.all([
      import('@vitejs/plugin-react'),
      import('@tailwindcss/vite'),
    ]);
    const vite = await createViteServer({
      configFile: false,
      plugins: [react(), tailwindcss()],
      resolve: { alias: { '@': __dirname } },
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
