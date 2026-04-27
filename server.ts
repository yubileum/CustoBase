import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies if needed
  app.use(express.json());

  // API route to proxy fetch requests to avoid CORS
  app.get("/api/proxy-csv", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ error: "Missing URL parameter" });
      }

      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
           return res.status(response.status).json({ error: `Access Denied (HTTP ${response.status}). Please ensure Google Sheets "General access" is set to "Anyone with the link".` });
        }
        return res.status(response.status).json({ error: `Failed to fetch data: ${response.status} ${response.statusText}` });
      }

      const text = await response.text();
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.send(text);
    } catch (error: any) {
      console.error("Proxy error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch data via proxy" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
