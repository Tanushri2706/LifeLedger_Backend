import { Server } from 'http';
import { app } from './app';
import { config, connectDatabase, disconnectDatabase } from './config';

let server: Server | null = null;
let isShuttingDown = false;

const startServer = async (): Promise<void> => {
  try {
    // 1. Connect to MongoDB Atlas / Local Database
    console.log('[LifeLedger Backend] Initializing database connection...');
    await connectDatabase();

    // 2. Start Express HTTP Server
    server = app.listen(config.port, () => {
      console.log(
        `[LifeLedger Backend] Server is running in ${config.nodeEnv} mode on port ${config.port}`
      );
      console.log(`[LifeLedger Backend] Client origin permitted: ${config.clientUrl}`);
      console.log(`[LifeLedger Backend] Health check available at: http://localhost:${config.port}/health`);
      console.log(`[LifeLedger Backend] API v1 base endpoint: http://localhost:${config.port}${config.apiPrefix}`);
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[LifeLedger Backend] Fatal error during startup: ${errorMessage}`);
    process.exit(1);
  }
};

const handleShutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[LifeLedger Backend] Received ${signal}. Starting graceful shutdown...`);

  // 1. Close HTTP Server (stop receiving new requests)
  if (server) {
    await new Promise<void>((resolve) => {
      server!.close(() => {
        console.log('[LifeLedger Backend] HTTP server closed.');
        resolve();
      });
    });
  }

  // 2. Disconnect from Database
  await disconnectDatabase();

  console.log('[LifeLedger Backend] Graceful shutdown completed. Exiting.');
  process.exit(0);
};

process.on('SIGTERM', () => void handleShutdown('SIGTERM'));
process.on('SIGINT', () => void handleShutdown('SIGINT'));

void startServer();
