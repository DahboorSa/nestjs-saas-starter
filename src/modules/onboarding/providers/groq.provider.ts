import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { IAiProvider } from './ai-provider.interface';

export class GroqProvider implements IAiProvider {
  private readonly client: Groq;

  constructor(config: ConfigService) {
    this.client = new Groq({
      apiKey: config.getOrThrow<string>('GROQ_API_KEY'),
    });
  }

  async ask(systemPrompt: string, question: string): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
      max_tokens: 1024,
    });

    return completion.choices[0]?.message?.content ?? '';
  }
}
