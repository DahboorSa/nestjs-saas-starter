import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { IAiProvider } from './ai-provider.interface';

export class ClaudeProvider implements IAiProvider {
  private readonly client: Anthropic;

  constructor(config: ConfigService) {
    this.client = new Anthropic({
      apiKey: config.getOrThrow<string>('ANTHROPIC_API_KEY'),
    });
  }

  async ask(systemPrompt: string, question: string): Promise<string> {
    const stream = this.client.messages.stream({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: question }],
    });

    const message = await stream.finalMessage();
    const textBlock = message.content.find((b) => b.type === 'text');
    return textBlock && textBlock.type === 'text' ? textBlock.text : '';
  }
}
