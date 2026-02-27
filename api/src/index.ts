import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { initNeo4j } from './utils/neo4j-client';
import voiceRouter from './routes/voice';
import scoutRouter from './routes/scout';
import verifyRouter from './routes/verify';
import governRouter from './routes/govern';
import financeRouter from './routes/finance';
import demoRouter from './routes/demo';
import walletRouter from './routes/wallet';
import agentRouter from './routes/agent';
import governanceRouter from './routes/governance';

// Load .env from project root
const envPath = path.join(__dirname, '../../.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });
console.log('NEO4J_URI:', process.env.NEO4J_URI);
console.log('NEO4J_USER:', process.env.NEO4J_USER);
console.log('NEO4J_PASSWORD:', process.env.NEO4J_PASSWORD ? '***' : 'NOT SET');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration for dashboard origin
const corsOrigin = process.env.CORS_ORIGIN || process.env.DASHBOARD_URL || 'http://localhost:3000';
console.log('CORS Origin:', corsOrigin);

app.use(cors({
  origin: corsOrigin,
  credentials: true
}));

// JSON parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  const health: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {}
  };

  // Check Neo4j connection
  try {
    const { getDriver } = await import('./utils/neo4j-client');
    const driver = getDriver();
    await driver.verifyConnectivity();
    health.services.neo4j = 'connected';
  } catch (error) {
    health.services.neo4j = 'disconnected';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// API routes
app.use('/api/voice', voiceRouter);
app.use('/api/scout', scoutRouter);
app.use('/api/verify', verifyRouter);
app.use('/api/govern', governRouter);
app.use('/api/finance', financeRouter);
app.use('/api/demo', demoRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/agent', agentRouter);
app.use('/api/governance', governanceRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`[ERROR] ${err.stack}`);
  
  const statusCode = (err as any).statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    error: err.name || 'Error',
    message,
    timestamp: new Date().toISOString(),
    path: req.path
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 FORGE API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  
  // Initialize Neo4j connection
  try {
    await initNeo4j();
    console.log('✅ Neo4j connection initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Neo4j:', error);
    console.warn('⚠️  Governance and audit features will not work');
  }
  
  // Initialize TEE Vault
  try {
    const { initializeTEEVault } = await import('./services/TEEVaultService');
    await initializeTEEVault();
    console.log('✅ TEE Vault initialized');
  } catch (error) {
    console.error('❌ Failed to initialize TEE Vault:', error);
    console.warn('⚠️  Wallet features will not work');
  }
});

export default app;
