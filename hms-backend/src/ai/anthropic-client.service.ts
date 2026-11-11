import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | Array<Record<string, unknown>>;
}

export interface AnthropicResponse {
  textBlocks: string[];
  toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  stopReason: string;
  raw: any;
}

/**
 * Thin wrapper around the Anthropic Messages API for server-side use.
 * This is a real backend calling api.anthropic.com with a server-held
 * API key - distinct from the client-side "AI-powered artifact" pattern
 * used inside Claude.ai, which proxies the key for you. Here, ANTHROPIC_API_KEY
 * must be set in your deployment environment.
 */
@Injectable()
export class AnthropicClientService {
  private readonly logger = new Logger(AnthropicClientService.name);
  private readonly apiKey: string | undefined;
  private readonly model = 'claude-sonnet-5';

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get('ANTHROPIC_API_KEY');
  }

  async send(params: {
    system: string;
    messages: AnthropicMessage[];
    tools?: AnthropicTool[];
    maxTokens?: number;
  }): Promise<AnthropicResponse> {
    if (!this.apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY not set - returning a stub response');
      return {
        textBlocks: ['(AI response unavailable: ANTHROPIC_API_KEY not configured)'],
        toolUseBlocks: [],
        stopReason: 'end_turn',
        raw: null,
      };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: params.maxTokens ?? 1024,
        system: params.system,
        messages: params.messages,
        ...(params.tools ? { tools: params.tools } : {}),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      this.logger.error(`Anthropic API error ${response.status}: ${errText}`);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content ?? [];

    return {
      textBlocks: content.filter((b: any) => b.type === 'text').map((b: any) => b.text),
      toolUseBlocks: content
        .filter((b: any) => b.type === 'tool_use')
        .map((b: any) => ({ id: b.id, name: b.name, input: b.input })),
      stopReason: data.stop_reason,
      raw: data,
    };
  }
}
