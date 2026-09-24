import { GoogleGenAI } from '@google/genai';

export interface ModelMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ModelAdapterOptions {
  modelName?: string;
  temperature?: number;
  systemInstruction?: string;
  jsonMode?: boolean;
}

export interface IModelAdapter {
  generateText(prompt: string, options?: ModelAdapterOptions): Promise<string>;
  generateStructured<T>(prompt: string, options?: ModelAdapterOptions): Promise<T>;
  name: string;
}

// Global cooldown tracker for models that reported high-demand (503) or rate-limit (429)
const modelCooldowns = new Map<string, number>();

function isTransientOrUnavailable(err: any): boolean {
  if (!err) return false;
  const status = err.status || err.code || err.statusCode;
  const msg = (err.message || '').toLowerCase();
  const raw = JSON.stringify(err).toLowerCase();

  return (
    status === 503 ||
    status === 429 ||
    status === 'UNAVAILABLE' ||
    status === 'RESOURCE_EXHAUSTED' ||
    msg.includes('high demand') ||
    msg.includes('temporary') ||
    msg.includes('try again later') ||
    msg.includes('unavailable') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    raw.includes('503') ||
    raw.includes('unavailable')
  );
}

/**
 * GeminiModelAdapter implements the IModelAdapter interface using the official @google/genai SDK.
 * Features intelligent model fallback across Gemini 3.x and 2.5 models with a circuit-breaker
 * cooldown mechanism that seamlessly bypasses models experiencing temporary 503 high-demand surges.
 */
export class GeminiModelAdapter implements IModelAdapter {
  public readonly name = 'gemini-3.8-flash';
  private client: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.client = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }

  private getClient(): GoogleGenAI {
    if (!this.client) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured in server environment.');
      }
      this.client = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return this.client;
  }

  async generateText(prompt: string, options?: ModelAdapterOptions): Promise<string> {
    const client = this.getClient();
    const primaryModel = options?.modelName || 'gemini-3.8-flash';

    // Model fallback sequence:
    // 1. Primary requested model (gemini-3.8-flash)
    // 2. High-availability Gemini 2.5 Flash
    // 3. Ultra-low latency Gemini 3.1 Flash Lite
    // 4. Gemini Flash Latest
    const baseCandidates = Array.from(
      new Set([primaryModel, 'gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'])
    ).filter(Boolean);

    // Dynamic Circuit Breaker: prioritize healthy models that are NOT currently in 503/429 cooldown
    const now = Date.now();
    const healthyCandidates = baseCandidates.filter((m) => (modelCooldowns.get(m) || 0) < now);
    const coolingCandidates = baseCandidates.filter((m) => (modelCooldowns.get(m) || 0) >= now);
    const candidateModels = healthyCandidates.length > 0 ? [...healthyCandidates, ...coolingCandidates] : baseCandidates;

    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: options?.systemInstruction,
            temperature: options?.temperature ?? 0.4,
            responseMimeType: options?.jsonMode ? 'application/json' : undefined,
          },
        });

        if (response.text) {
          // Model succeeded: if it was previously cooling, clear the cooldown
          if (modelCooldowns.has(model)) {
            modelCooldowns.delete(model);
          }
          return response.text;
        }
      } catch (err: any) {
        lastError = err;
        const isTransient = isTransientOrUnavailable(err);

        if (isTransient) {
          // Put this model in a 45-second cooldown so subsequent requests don't waste time on it
          modelCooldowns.set(model, Date.now() + 45000);
          console.log(`[GeminiAdapter] Model "${model}" temporarily busy, automatically routing to alternative model...`);
          // Immediately try the next candidate model
          continue;
        }

        // For non-transient errors, break and report
        break;
      }
    }

    throw lastError || new Error('所有 Gemini 备用模型均无法完成请求');
  }

  async generateStructured<T>(prompt: string, options?: ModelAdapterOptions): Promise<T> {
    const raw = await this.generateText(prompt, {
      ...options,
      jsonMode: true,
    });

    try {
      // Find JSON block if wrapped in markdown code fence
      let cleaned = raw.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      return JSON.parse(cleaned) as T;
    } catch (err: any) {
      console.error('Failed to parse structured JSON from model:', raw);
      throw new Error(`Model returned invalid JSON: ${err.message}`);
    }
  }
}

// Global singleton instance
export const defaultModelAdapter = new GeminiModelAdapter();
