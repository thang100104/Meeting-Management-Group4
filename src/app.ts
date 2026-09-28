import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { requestIdMiddleware } from './middlewares/requestId';
import { requestLoggerMiddleware } from './middlewares/logger.middleware';
import { errorHandlerMiddleware } from './middlewares/error.middleware';
import apiRouter from './routes';
import { NotFoundError } from './utils/errors';

export function createApp(): Express {
  const app = express();

  // Security & utility middlewares
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: ["'self'"],
        },
      },
    })
  );
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Custom tracing & logging middlewares
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);

  // Serve static files from 'public' directory
  const publicDir = path.resolve(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  app.use(express.static(publicDir));

  // API v1 Routing
  app.use('/api/v1', apiRouter);

  // Unmatched API routes return standard 404 JSON
  app.all('/api/v1/*', (req, _res, next) => {
    next(new NotFoundError(`Đường dẫn không tồn tại: ${req.method} ${req.originalUrl}`));
  });

  // Catch all other non-API routes -> serve SPA index.html
  app.get('*', (_req, res) => {
    const indexPath = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Frontend index.html not found');
    }
  });

  // Global Error Handler
  app.use(errorHandlerMiddleware);

  return app;
}

export default createApp;
