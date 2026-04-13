export interface FlagResult {
  value: unknown;
  type: string;
  variant?: string;
  reason: string;
}

/** Context passed to the evaluation API. Any extra key is forwarded as-is for attribute matching. */
export interface EvaluationContext {
  userId?: string;
  identifier?: string;
  attributes?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface VexilClientOptions {
  /** Environment API key (Bearer token) */
  apiKey: string;
  /** Vexil API base URL, e.g. https://your-api.railway.app */
  baseUrl: string;
  /** Polling interval in ms (default: 30_000) */
  pollingInterval?: number;
  /** Flush analytics events every N ms (default: 10_000) */
  flushInterval?: number;
  /** Called when the flag cache is refreshed */
  onFlagsUpdated?: (flags: Record<string, FlagResult>) => void;
  /** Called on errors */
  onError?: (err: Error) => void;
}

/**
 * VexilClient evaluates feature flags by polling the Vexil API.
 *
 * Usage:
 *   const client = new VexilClient({ apiKey, baseUrl });
 *   await client.init({ userId: 'alice' });
 *   if (client.isEnabled('my-flag')) { ... }
 *   await client.destroy(); // flush events + stop polling
 */
export class VexilClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly pollingInterval: number;
  private readonly flushInterval: number;
  private readonly onFlagsUpdated?: (flags: Record<string, FlagResult>) => void;
  private readonly onError?: (err: Error) => void;

  private flags: Record<string, FlagResult> = {};
  private context: EvaluationContext = {};
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private eventQueue: Array<{ flagKey: string; result: boolean; context?: unknown; timestamp: string }> = [];

  constructor(options: VexilClientOptions) {
    this.apiKey = options.apiKey;
    // Strip trailing slash so callers don't have to worry about it.
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.pollingInterval = options.pollingInterval ?? 30_000;
    this.flushInterval = options.flushInterval ?? 10_000;
    this.onFlagsUpdated = options.onFlagsUpdated;
    this.onError = options.onError;
  }

  /**
   * Fetches flags for the given context, then starts background polling and event flushing.
   * Must be called before any flag reads.
   */
  async init(context?: EvaluationContext): Promise<void> {
    if (context) this.context = context;
    await this.refresh();
    this.pollTimer = setInterval(() => this.refresh().catch(this.handleError.bind(this)), this.pollingInterval);
    this.flushTimer = setInterval(() => this.flush().catch(this.handleError.bind(this)), this.flushInterval);
  }

  /**
   * Switches the user context and immediately re-evaluates all flags.
   * Use when the logged-in user changes (e.g. login, account switch).
   */
  async identify(context: EvaluationContext): Promise<void> {
    this.context = context;
    await this.refresh();
  }

  /** Convenience check — returns false if the flag doesn't exist or its value is falsy. */
  isEnabled(flagKey: string, defaultValue = false): boolean {
    const flag = this.flags[flagKey];
    if (!flag) return defaultValue;
    return Boolean(flag.value);
  }

  /** Returns the full result including reason and variant, or undefined if the flag isn't loaded. */
  getFlag(flagKey: string): FlagResult | undefined {
    return this.flags[flagKey];
  }

  /** Returns a shallow copy of all cached flag results. */
  getAllFlags(): Record<string, FlagResult> {
    return { ...this.flags };
  }

  /** Returns the flag's value cast to T, or defaultValue if missing. */
  getValue<T>(flagKey: string, defaultValue: T): T {
    const flag = this.flags[flagKey];
    if (!flag) return defaultValue;
    return (flag.value as T) ?? defaultValue;
  }

  /** Manually enqueues an evaluation event for analytics. Events are flushed on the flushInterval. */
  track(flagKey: string, result: boolean, context?: unknown): void {
    this.eventQueue.push({ flagKey, result, context, timestamp: new Date().toISOString() });
  }

  /**
   * Sends all buffered events to the API in one batch and empties the queue.
   * splice(0) is atomic — no events are lost if a concurrent track() fires during the flush.
   */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;
    const batch = this.eventQueue.splice(0, this.eventQueue.length);
    await this.post('/v1/events', batch);
  }

  /** Stops polling and event timers, then flushes any remaining events. */
  async destroy(): Promise<void> {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    if (this.flushTimer) { clearInterval(this.flushTimer); this.flushTimer = null; }
    await this.flush().catch(() => {});
  }

  /** Calls the evaluate endpoint and updates the local flag cache. */
  private async refresh(): Promise<void> {
    const data = await this.post<{ flags: Record<string, FlagResult> }>('/v1/flags/evaluate', {
      context: this.context,
    });
    this.flags = data.flags;
    this.onFlagsUpdated?.(this.flags);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(`Vexil API error ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  private handleError(err: unknown): void {
    const error = err instanceof Error ? err : new Error(String(err));
    this.onError?.(error);
  }
}

export default VexilClient;
