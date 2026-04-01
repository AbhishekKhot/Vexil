import axios, { AxiosInstance } from 'axios';

export interface VexilConfig {
  apiKey: string;
  baseUrl: string;
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

export class VexilClient {
  private client: AxiosInstance;
  private flags: FlagMap = {};
  private apiKey: string;

  constructor(config: VexilConfig) {
    this.apiKey = config.apiKey;
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Fetches the latest flag evaluations for the given context.
   * This should be called once on application startup or when user context changes.
   */
  async fetchFlags(context: Record<string, any> = {}): Promise<FlagMap> {
    try {
      const response = await this.client.post('/v1/eval', { context });
      this.flags = response.data.flags || {};
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
   * Sends a batch of evaluation events for analytics.
   */
  async trackEvents(events: Array<{ flagKey: string, result: boolean, context?: any, timestamp?: string }>): Promise<void> {
    try {
      await this.client.post('/v1/events', events);
    } catch (error: any) {
      console.error('[Vexil] Failed to track events:', error.response?.data?.error || error.message);
    }
  }
}

export function createVexilClient(config: VexilConfig): VexilClient {
  return new VexilClient(config);
}
