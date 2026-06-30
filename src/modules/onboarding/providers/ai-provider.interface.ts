export interface IAiProvider {
  ask(systemPrompt: string, question: string): Promise<string>;
}

export const AI_PROVIDER = 'AI_PROVIDER';
