import express from 'express';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './server/routes';

dotenv.config();

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const PORT = isProd ? (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000) : 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Mount API routes
app.use('/api', apiRouter);

// Serve output files statically
app.use('/data/outputs', express.static(path.resolve(process.cwd(), 'data', 'outputs')));

async function startServer() {
  if (!isProd) {
    // In development mode, mount Vite middlewares
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production mode, serve built assets
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Personal Agent Workbench] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
