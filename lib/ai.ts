import { embed, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function embedText(value: string) {
  return await embed({
    model: openai.embedding('text-embedding-3-small'),
    value,
  });
}

export async function embedTexts(values: string[]) {
  return await embedMany({
    model: openai.embedding('text-embedding-3-small'),
    values,
  });
}

export function generateChunks(input: string): string[] {
  return input
    .trim()
    .split('.')
    .filter(i => i !== '');
};
