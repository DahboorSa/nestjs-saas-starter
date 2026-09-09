import { ConfigService } from '@nestjs/config';
import { GroqProvider } from './groq.provider';

const mockCreate = jest.fn();

jest.mock('groq-sdk', () =>
  jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
);

const makeConfig = (overrides: Record<string, string> = {}) => {
  const values: Record<string, string> = {
    GROQ_API_KEY: 'gsk_test',
    ...overrides,
  };
  return {
    getOrThrow: jest.fn((key: string) => values[key]),
    get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
  } as unknown as ConfigService;
};

describe('GroqProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'answer' } }],
    });
  });

  it('defaults to openai/gpt-oss-20b when GROQ_MODEL is unset', async () => {
    const provider = new GroqProvider(makeConfig());

    await provider.ask('system', 'question');

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'openai/gpt-oss-20b' }),
    );
  });

  it('uses GROQ_MODEL when set', async () => {
    const provider = new GroqProvider(
      makeConfig({ GROQ_MODEL: 'openai/gpt-oss-120b' }),
    );

    await provider.ask('system', 'question');

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'openai/gpt-oss-120b' }),
    );
  });

  it('sends system and user messages and returns the completion text', async () => {
    const provider = new GroqProvider(makeConfig());

    const result = await provider.ask('system prompt', 'my question');

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: 'system', content: 'system prompt' },
          { role: 'user', content: 'my question' },
        ],
        max_completion_tokens: 2048,
      }),
    );
    expect(result).toBe('answer');
  });

  it('returns an empty string when the model returns no content', async () => {
    mockCreate.mockResolvedValue({ choices: [] });
    const provider = new GroqProvider(makeConfig());

    expect(await provider.ask('system', 'question')).toBe('');
  });
});
