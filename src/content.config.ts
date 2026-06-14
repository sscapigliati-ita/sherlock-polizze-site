import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const guide = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guide' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    description: z.string(),
    keywords: z.string().optional(),
    date: z.coerce.date(),
    author: z.string().default('Stefano Scapigliati'),
  }),
});

export const collections = { guide };
