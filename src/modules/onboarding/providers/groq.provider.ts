import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { IAiProvider } from './ai-provider.interface';

const DEFAULT_MODEL = 'openai/gpt-oss-20b';

export class GroqProvider implements IAiProvider {
  private readonly client: Groq;
  private readonly model: string;

  constructor(config: ConfigService) {
    this.client = new Groq({
      apiKey: config.getOrThrow<string>('GROQ_API_KEY'),
    });
    this.model = config.get<string>('GROQ_MODEL', DEFAULT_MODEL);
  }

  async ask(systemPrompt: string, question: string): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
      max_completion_tokens: 2048,
    });

    return completion.choices[0]?.message?.content ?? '';
  }
}
