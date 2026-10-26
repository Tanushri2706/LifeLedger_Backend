import dns from 'node:dns';
import mongoose from 'mongoose';
import { config } from './index';

let isListenersAttached = false;
let isDnsConfigured = false;

export const configureDnsServers = (servers?: readonly string[]): void => {
  const targetServers =
    servers && servers.length > 0
      ? servers
      : (typeof config !== 'undefined' && config?.dnsServers)
        ? config.dnsServers
        : (process.env.DNS_SERVERS
            ? process.env.DNS_SERVERS.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
            : ['1.1.1.1', '8.8.8.8']);
  if (!targetServers || targetServers.length === 0) return;
  if (isDnsConfigured && !servers) return;

  try {
    const serverList = [...targetServers];
    dns.setServers(serverList);
    if (typeof dns.promises?.setServers === 'function') {
      dns.promises.setServers(serverList);
    }
    isDnsConfigured = true;
    console.log(`[Database] Node DNS resolver configured with servers: ${serverList.join(', ')}`);
  } catch (error) {
    console.warn('[Database] Failed to configure DNS servers:', error instanceof Error ? error.message : error);
  }
};

const attachConnectionListeners = (): void => {
  if (isListenersAttached) return;

  mongoose.connection.on('error', (err) => {
    console.error('[Database] MongoDB connection error:', err instanceof Error ? err.message : err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[Database] MongoDB connection disconnected.');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[Database] MongoDB connection re-established.');
  });

  isListenersAttached = true;
};

export const connectDatabase = async (): Promise<typeof mongoose> => {
  configureDnsServers();
  attachConnectionListeners();

  try {
    const connection = await mongoose.connect(config.mongodbUri);
    const host = connection.connection.host || 'unknown-host';
    const dbName = connection.connection.name || 'default';

    console.log(`[Database] MongoDB connected successfully to database "${dbName}" at host: ${host}`);
    return connection;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Database] Failed to connect to MongoDB: ${errorMessage}`);
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.connection.close();
      console.log('[Database] MongoDB connection closed cleanly.');
    } catch (error) {
      console.error('[Database] Error while closing MongoDB connection:', error instanceof Error ? error.message : error);
    }
  }
};

export const isDatabaseConnected = (): boolean => {
  return mongoose.connection.readyState === 1;
};
