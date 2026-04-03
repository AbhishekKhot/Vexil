import axios, { AxiosInstance } from 'axios';

export interface VexilConfig {
  apiKey: string;
  baseUrl: string;
  /**
   * Polling interval in milliseconds. Set to re-fetch flags automatically.
   * Default: 0 (disabled). Suggested: 30000 (30s).
   */
  pollingInterval?: number;
}

export interface FlagResult {
  value: any;
  type: string;
  variant?: string;
  reason?: string;
}

export interface FlagMap {
  [key: string]: FlagResult;
}

interface BufferedEvent {
  flagKey: string;
  result: boolean;
  count: number;
}

const FLUSH_INTERVAL_MS = 30_000;
const FLUSH_BUFFER_SIZE = 1_000;

export class VexilClient {
  private client: AxiosInstance;
  private flags: FlagMap = {};
  private apiKey: string;

  // Analytics buffer: flagKey → aggregated counts
  private eventBuffer = new Map<string, BufferedEvent>();
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  // Polling
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private lastContext: Record<string, any> = {};

  constructor(config: VexilConfig) {
    this.apiKey = config.apiKey;
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    // Start analytics flush timer
    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);

    // Start polling if configured
    if (config.pollingInterval && config.pollingInterval > 0) {
      this.pollingTimer = setInterval(async () => {
        try {
          await this.fetchFlags(this.lastContext);
        } catch {
          // swallow polling errors silently
        }
      }, config.pollingInterval);
    }
  }

  /**
   * Fetches the latest flag evaluations for the given context.
   * Automatically captures evaluations for analytics.
   */
  async fetchFlags(context: Record<string, any> = {}): Promise<FlagMap> {
    this.lastContext = context;
    try {
      const response = await this.client.post('/v1/eval', { context });
      this.flags = response.data.flags || {};

      // Auto-capture each evaluated flag
      for (const [flagKey, result] of Object.entries(this.flags)) {
        this.captureEvaluation(flagKey, result.value === true, context);
      }

      return this.flags;
    } catch (error: any) {
      console.error('[Vexil] Failed to fetch flags:', error.response?.data?.error || error.message);
      throw error;
    }
  }

  /**
   * Checks if a boolean flag is enabled.
   * Returns false if the flag is missing or not a boolean.
   */
  isEnabled(key: string): boolean {
    const flag = this.flags[key];
    if (!flag) return false;
    return flag.value === true;
  }

  /**
   * Gets the value of a flag.
   * Returns null if missing.
   */
  getValue<T = any>(key: string): T | null {
    const flag = this.flags[key];
    if (!flag) return null;
    return flag.value as T;
  }

  /**
   * Gets the full evaluation details of a flag.
   * Returns null if missing.
   */
  getDetails(key: string): FlagResult | null {
    return this.flags[key] || null;
  }

  /**
   * Buffers an evaluation event. Called automatically by fetchFlags.
   * Can also be called manually for custom tracking.
   */
  captureEvaluation(flagKey: string, result: boolean, _context?: Record<string, any>): void {
    const existing = this.eventBuffer.get(flagKey);
    if (existing) {
      existing.count++;
      if (result) existing.result = result; // track last result for the batch
    } else {
      this.eventBuffer.set(flagKey, { flagKey, result, count: 1 });
    }

    if (this.eventBuffer.size >= FLUSH_BUFFER_SIZE) {
      this.flush();
    }
  }

  /**
   * Flushes buffered events to the analytics endpoint.
   * Called automatically every 30s or when buffer reaches 1000 events.
   */
  async flush(): Promise<void> {
    if (this.eventBuffer.size === 0) return;

    const events = Array.from(this.eventBuffer.values()).map((e) => ({
      flagKey: e.flagKey,
      result: e.result,
      timestamp: new Date().toISOString(),
    }));
    this.eventBuffer.clear();

    try {
      await this.client.post('/v1/events', events);
    } catch (error: any) {
      console.error('[Vexil] Failed to flush analytics events:', error.response?.data?.error || error.message);
    }
  }

  /**
   * Manually sends a batch of evaluation events. Legacy method kept for compatibility.
   */
  async trackEvents(events: Array<{ flagKey: string; result: boolean; context?: any; timestamp?: string }>): Promise<void> {
    try {
      await this.client.post('/v1/events', events);
    } catch (error: any) {
      console.error('[Vexil] Failed to track events:', error.response?.data?.error || error.message);
    }
  }

  /**
   * Stops background polling (if started with pollingInterval).
   */
  stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * Flushes remaining events and clears all timers.
   * Call on app shutdown or in SSR cleanup.
   */
  async destroy(): Promise<void> {
    this.stopPolling();
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}

export function createVexilClient(config: VexilConfig): VexilClient {
  return new VexilClient(config);
}
