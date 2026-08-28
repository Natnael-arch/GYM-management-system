// @ts-ignore
import ZKLib from 'zkteco-js';
import { EventEmitter } from 'events';

export interface DeviceUser {
  uid: number;
  userid: string;
  name: string;
  role: number;
  password?: string;
  cardno?: number;
}

class ZKTecoService extends EventEmitter {
  private instance: ZKLib | null = null;
  private isConnected = false;
  private ip: string;
  private port: number;
  private inport: number;
  private timeout: number;
  private mockMode: boolean;
  private reconnectInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.ip = process.env.ZKTECO_IP || '192.168.1.201';
    this.port = parseInt(process.env.ZKTECO_PORT || '4370', 10);
    this.inport = 4000;
    this.timeout = 10000;
    this.mockMode = process.env.MOCK_ZKTECO === 'true';
    if (this.mockMode && process.env.NODE_ENV === 'production') {
      console.error('[ZKTeco] ERROR: MOCK_ZKTECO=true is ignored in production. Connecting to real device.');
      this.mockMode = false;
    }
  }

  async connect() {
    if (this.mockMode) {
      console.log(`[ZKTeco Mock] Connecting to mock device at ${this.ip}:${this.port}...`);
      this.isConnected = true;
      this.emit('status', true);
      this.startMockLogs();
      return;
    }

    if (this.isConnected) return;

    try {
      console.log(`[ZKTeco] Attempting to connect to ${this.ip}:${this.port}...`);
      this.instance = new ZKLib(this.ip, this.port, this.timeout, this.inport);
      await this.instance.createSocket();
      this.isConnected = true;
      console.log('[ZKTeco] Connected successfully.');
      this.emit('status', true);

      // Setup real-time logs
      await this.instance.getRealTimeLogs((err: any, cbData: any) => {
        if (err) {
          console.error('[ZKTeco] Real-time log error:', err);
          return;
        }
        if (cbData) {
          console.log('[ZKTeco] Real-time scan event:', cbData);
          this.emit('attendance', {
            deviceUserId: cbData.userid.toString(),
            timestamp: new Date()
          });
        }
      });
      
    } catch (err) {
      console.error('[ZKTeco] Connection failed:', err);
      this.isConnected = false;
      this.emit('status', false);
      this.scheduleReconnect();
    }
  }

  async disconnect() {
    if (this.mockMode) {
      this.isConnected = false;
      this.emit('status', false);
      return;
    }
    
    if (this.instance) {
      try {
        await this.instance.disconnect();
      } catch (err) {
        console.error('[ZKTeco] Disconnect error:', err);
      }
      this.isConnected = false;
      this.emit('status', false);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectInterval) return;
    console.log('[ZKTeco] Scheduling reconnect in 10s...');
    this.reconnectInterval = setTimeout(async () => {
      this.reconnectInterval = null;
      await this.connect();
    }, 10000);
  }

  async getUsers(): Promise<DeviceUser[]> {
    if (this.mockMode) {
      // Return dummy users for testing the UI
      return [
        { uid: 1, userid: '1001', name: 'Mock User 1', role: 0 },
        { uid: 2, userid: '1002', name: 'Mock User 2', role: 0 },
        { uid: 3, userid: '1003', name: 'Mock User 3', role: 0 },
        { uid: 4, userid: '1004', name: 'Mock User 4', role: 0 },
        { uid: 5, userid: '1005', name: 'Mock User 5', role: 0 },
      ];
    }

    if (!this.isConnected || !this.instance) {
      throw new Error("ZKTeco device is not connected.");
    }

    try {
      const usersData = await this.instance.getUsers();
      return usersData.data || [];
    } catch (err) {
      console.error('[ZKTeco] Failed to get users:', err);
      throw err;
    }
  }
  
  getStatus() {
    return this.isConnected;
  }

  private startMockLogs() {
    // Every 30 seconds, simulate a random fingerprint scan from our mock users
    setInterval(() => {
      const randomUserId = ['1001', '1002', '1003', '1004', '1005'][Math.floor(Math.random() * 5)];
      console.log(`[ZKTeco Mock] Simulating scan for deviceUserId: ${randomUserId}`);
      this.emit('attendance', {
        deviceUserId: randomUserId,
        timestamp: new Date()
      });
    }, 30000);
  }
}

// Global singleton so it persists across Next.js HMR in development
const globalForZKTeco = globalThis as unknown as {
  zktecoService: ZKTecoService | undefined;
};

export const zktecoService = globalForZKTeco.zktecoService ?? new ZKTecoService();
if (process.env.NODE_ENV !== 'production') globalForZKTeco.zktecoService = zktecoService;
