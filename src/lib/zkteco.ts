import { EventEmitter } from 'events';
import { spawn, execFile, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface DeviceUser {
  uid: number;
  userid: string;
  name: string;
  role: number;
  password?: string;
  cardno?: number;
}

export interface DeviceInfo {
  deviceName?: string;
  serialNumber?: string;
  mac?: string;
  firmwareVersion?: string;
  platform?: string;
}

export interface DiagInfo {
  ip: string;
  port: number;
  tcpReachable: boolean;
  tcpError?: string;
  pyzkVersion?: string;
  [k: string]: unknown;
}

function resolvePython(): string {
  if (process.env.ZKTECO_PYTHON && fs.existsSync(process.env.ZKTECO_PYTHON)) {
    return process.env.ZKTECO_PYTHON;
  }
  // 'python' works on Windows; 'python3' on most Linux/Docker images.
  // execFile with shell:false needs an exact binary, so probe PATH.
  const candidates = process.platform === 'win32' ? ['python', 'python3'] : ['python3', 'python'];
  if (process.env.ZKTECO_PYTHON) candidates.unshift(process.env.ZKTECO_PYTHON);
  return candidates[0];
}

function extractLastJson(stdout: string): string {
  const lines = stdout.split('\n').map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.startsWith('{') || line.startsWith('[')) return line;
  }
  return stdout.trim();
}

class ZKTecoService extends EventEmitter {
  private isConnected = false;
  private ip: string;
  private port: number;
  private mockMode: boolean;
  private listenerProcess: ChildProcess | null = null;
  private listenerBuffer = '';
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private mockInterval: NodeJS.Timeout | null = null;
  private scriptPath: string;
  private pythonBin: string;
  private lastError: string | null = null;
  private lastSeen: Date | null = null;
  private connectPromise: Promise<void> | null = null;
  // Serialize all one-shot python calls: MB devices allow 1 connection.
  private queue: Promise<unknown> = Promise.resolve();

  constructor() {
    super();
    this.ip = process.env.ZKTECO_IP || '192.168.100.5';
    this.port = parseInt(process.env.ZKTECO_PORT || '4370', 10);
    this.mockMode = process.env.MOCK_ZKTECO === 'true';
    this.scriptPath = path.resolve(process.cwd(), 'fingerprint-code', 'zk_manager.py');
    this.pythonBin = resolvePython();

    if (this.mockMode && process.env.NODE_ENV === 'production') {
      console.error('[ZKTeco] ERROR: MOCK_ZKTECO=true is ignored in production. Connecting to real device.');
      this.mockMode = false;
    }
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    // Keep chain alive even if this call rejects.
    this.queue = run.catch(() => undefined);
    return run;
  }

  private runPython<T>(action: string, ...args: (string | number)[]): Promise<T> {
    return this.enqueue(
      () =>
        new Promise<T>((resolve, reject) => {
          const execArgs = [this.scriptPath, action, ...args.map(String)];
          const cmdTimeout = action.includes('enroll') ? 75000 : 15000;
          execFile(
            this.pythonBin,
            execArgs,
            {
              env: {
                ...process.env,
                ZKTECO_IP: this.ip,
                ZKTECO_PORT: String(this.port),
              },
              timeout: cmdTimeout,
              maxBuffer: 10 * 1024 * 1024,
            },
            (error, stdout, stderr) => {
              const out = (stdout || '').trim();
              const errText = (stderr || '').trim();
              if (error) {
                // Prefer structured JSON error from python if present.
                const candidate = extractLastJson(out);
                try {
                  const parsed = JSON.parse(candidate);
                  const hint =
                    (parsed as { hint?: string }).hint ||
                    (parsed as { error?: string }).error ||
                    errText;
                  if (hint) this.lastError = String(hint).slice(0, 500);
                  // Resolve with payload so callers can inspect
                  // { error, connected:false } instead of throwing raw text.
                  if (parsed && typeof parsed === 'object' && 'error' in parsed) {
                    return resolve(parsed as T);
                  }
                } catch {
                  /* fall through */
                }
                const msg = errText || error.message || 'Python bridge failed';
                this.lastError = `${action}: ${msg}`.slice(0, 500);
                // Add actionable hint for the #1 cause: ENOENT / bad IP.
                const hintMsg =
                  /ENOENT/i.test(msg) || /not found/i.test(msg)
                    ? `${msg} (python binary '${this.pythonBin}' missing — set ZKTECO_PYTHON)`
                    : `${msg} — device ${this.ip}:${this.port} unreachable? Same LAN/firewall? Single-connection busy? Run: python fingerprint-code/zk_manager.py diag`;
                return reject(new Error(hintMsg));
              }
              try {
                const data = JSON.parse(extractLastJson(out));
                this.lastSeen = new Date();
                resolve(data as T);
              } catch {
                this.lastError = `Unparseable output for ${action}: ${out.slice(0, 200)}`.trim();
                reject(new Error(this.lastError || `Unparseable device output for ${action}`));
              }
            },
          );
        }),
    );
  }

  async connect() {
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = this._connect().finally(() => {
      this.connectPromise = null;
    });
    return this.connectPromise;
  }

  private async _connect() {
    if (this.mockMode) {
      console.log(`[ZKTeco Mock] Connecting to mock device at ${this.ip}:${this.port}...`);
      this.isConnected = true;
      this.lastError = null;
      this.emit('status', true);
      this.startMockLogs();
      return;
    }

    if (this.isConnected) return;

    try {
      console.log(`[ZKTeco] Connecting to hardware at ${this.ip}:${this.port}...`);
      const info = await this.runPython<DeviceInfo & { error?: string }>('json_info');
      if (info && (info as { error?: string }).error) {
        throw new Error((info as { error?: string }).error);
      }
      console.log('[ZKTeco] Connected successfully. Hardware Info:', info);
      this.isConnected = true;
      this.lastError = null;
      this.emit('status', true);

      // Start live attendance listener in background
      this.startLiveListener();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[ZKTeco] Hardware connection failed:', msg);
      this.lastError = msg.slice(0, 500);
      this.isConnected = false;
      this.emit('status', false);
      this.scheduleReconnect();
    }
  }

  private stopListener(): Promise<void> {
    return new Promise((resolve) => {
      const proc = this.listenerProcess;
      this.listenerProcess = null;
      this.listenerBuffer = '';
      if (!proc || proc.killed) return resolve();
      try {
        const done = () => resolve();
        proc.once('exit', done);
        proc.kill('SIGTERM');
        // Force-kill if it lingers (device socket may be stuck), then resolve.
        setTimeout(() => {
          try {
            if (!proc.killed) proc.kill('SIGKILL');
          } catch {}
          resolve();
        }, 2500);
      } catch {
        resolve();
      }
    });
  }

  private startLiveListener() {
    if (this.mockMode) return;
    // Kill any stale listener first (fire-and-forget, then start fresh).
    if (this.listenerProcess) {
      const stale = this.listenerProcess;
      this.listenerProcess = null;
      try {
        stale.kill();
      } catch {}
    }

    let proc: ChildProcess;
    try {
      proc = spawn(this.pythonBin, [this.scriptPath, 'listen'], {
        env: {
          ...process.env,
          ZKTECO_IP: this.ip,
          ZKTECO_PORT: String(this.port),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      console.error('[ZKTeco Listener] spawn failed:', err);
      this.scheduleReconnect();
      return;
    }

    this.listenerProcess = proc;
    this.listenerBuffer = '';

    proc.stdout?.on('data', (data: Buffer) => {
      this.listenerBuffer += data.toString();
      const parts = this.listenerBuffer.split('\n');
      // Keep incomplete trailing line buffered for next chunk.
      this.listenerBuffer = parts.pop() ?? '';
      for (const raw of parts) {
        const line = raw.trim();
        if (!line) continue;
        try {
          const payload = JSON.parse(line);
          if (payload.event === 'attendance') {
            console.log('[ZKTeco] Real-time live scan event:', payload);
            this.lastSeen = new Date();
            this.emit('attendance', {
              deviceUserId: String(payload.deviceUserId),
              timestamp: new Date(payload.timestamp || Date.now()),
              punch: payload.punch,
              status: payload.status,
            });
          } else if (payload.event === 'status') {
            if (payload.heartbeat) {
              this.lastSeen = new Date();
            } else {
              this.isConnected = !!payload.connected;
              if (!this.isConnected && payload.error) {
                this.lastError = String(payload.error).slice(0, 500);
              }
              this.emit('status', this.isConnected);
            }
          }
        } catch {
          // Non-JSON log line from python — ignore (stderr carries logs).
        }
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString().trim();
      if (text) console.log(`[ZKTeco Listener] ${text}`);
    });

    proc.on('error', (err) => {
      console.error('[ZKTeco Listener] process error:', err);
      this.listenerProcess = null;
      this.isConnected = false;
      this.emit('status', false);
      if (!this.mockMode) this.scheduleReconnect();
    });

    proc.on('exit', (code) => {
      console.log(`[ZKTeco Listener] Process exited with code ${code}`);
      if (this.listenerProcess === proc) this.listenerProcess = null;
      // If we stopped it intentionally for enroll/disconnect, don't reconnect.
      // Intentional stops null listenerProcess BEFORE kill, but the exiting
      // proc is the old one — detect via isConnected flag set by caller.
      if (!this.mockMode && this.isConnected) {
        this.isConnected = false;
        this.emit('status', false);
        this.scheduleReconnect();
      }
    });
  }

  async disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.mockInterval) {
      clearInterval(this.mockInterval);
      this.mockInterval = null;
    }
    this.isConnected = false;
    await this.stopListener();
    this.emit('status', false);
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout || this.mockMode) return;
    console.log('[ZKTeco] Scheduling reconnect in 10s...');
    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;
      await this.connect();
    }, 10000);
  }

  async getUsers(): Promise<DeviceUser[]> {
    if (this.mockMode) {
      return [
        { uid: 1, userid: '1001', name: 'Mock User 1', role: 0 },
        { uid: 2, userid: '1002', name: 'Mock User 2', role: 0 },
        { uid: 3, userid: '1003', name: 'Mock User 3', role: 0 },
      ];
    }

    const users = await this.runPython<DeviceUser[] & { error?: string }>('json_users');
    if (users && typeof users === 'object' && 'error' in (users as object)) {
      throw new Error((users as unknown as { error: string }).error || 'Device unreachable');
    }
    return Array.isArray(users) ? users : [];
  }

  async getAttendance(): Promise<Array<{ user_id: string; timestamp: string; status: number; punch: number }>> {
    if (this.mockMode) return [];
    const logs = await this.runPython<Array<{ user_id: string; timestamp: string; status: number; punch: number }>>(
      'json_attendance',
    );
    return Array.isArray(logs) ? logs : [];
  }

  async diagnose(): Promise<DiagInfo> {
    if (this.mockMode) {
      return { ip: this.ip, port: this.port, tcpReachable: true, pyzkVersion: 'mock' };
    }
    try {
      return await this.runPython<DiagInfo>('json_diag');
    } catch (err) {
      return {
        ip: this.ip,
        port: this.port,
        tcpReachable: false,
        tcpError: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getInfo(): Promise<DeviceInfo> {
    if (this.mockMode) {
      return { deviceName: 'Mock Device', firmwareVersion: 'v1.0' };
    }
    const info = await this.runPython<DeviceInfo & { error?: string }>('json_info');
    if (info && (info as { error?: string }).error) {
      throw new Error((info as { error?: string }).error);
    }
    return info;
  }

  async unlock(seconds: number = 3): Promise<boolean> {
    if (this.mockMode) {
      console.log(`[ZKTeco Mock] Door unlocked for ${seconds}s.`);
      return true;
    }
    try {
      const res = await this.runPython<{ success: boolean }>('json_unlock', seconds);
      console.log(`[ZKTeco] Door unlocked for ${seconds}s:`, res);
      return res?.success ?? true;
    } catch (err) {
      console.error('[ZKTeco] Unlock failed:', err);
      return false;
    }
  }

  async enrollUser(userId: string, name?: string): Promise<{ success: boolean; error?: string }> {
    if (this.mockMode) {
      console.log(`[ZKTeco Mock] Enrolled mock user: ${userId}`);
      return { success: true };
    }
    const pin = String(userId).trim();
    if (!pin) return { success: false, error: 'deviceUserId is required' };
    try {
      // Pause live listener so enroll owns the single device connection.
      this.isConnected = false;
      await this.stopListener();
      // Give the device a moment to release the socket.
      await new Promise((r) => setTimeout(r, 1500));
      const res = await this.runPython<{ success: boolean; error?: string }>(
        'json_enroll',
        pin,
        name || '',
      );
      await this.connect();
      return res;
    } catch (err: unknown) {
      await this.connect();
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[ZKTeco] Enrollment failed:', msg);
      return { success: false, error: msg };
    }
  }

  async wipe(): Promise<boolean> {
    if (this.mockMode) return true;
    try {
      const res = await this.runPython<{ success: boolean }>('json_wipe');
      return res?.success ?? true;
    } catch (err) {
      console.error('[ZKTeco] Wipe failed:', err);
      return false;
    }
  }

  getStatus() {
    return this.isConnected;
  }

  getLastError() {
    return this.lastError;
  }

  getDeviceEndpoint() {
    return { ip: this.ip, port: this.port, mock: this.mockMode };
  }

  private startMockLogs() {
    if (this.mockInterval) return;
    this.mockInterval = setInterval(() => {
      const randomUserId = ['1001', '1002', '1003'][Math.floor(Math.random() * 3)];
      console.log(`[ZKTeco Mock] Simulating scan for deviceUserId: ${randomUserId}`);
      this.emit('attendance', {
        deviceUserId: randomUserId,
        timestamp: new Date(),
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
