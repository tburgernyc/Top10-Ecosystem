import { google } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { db, dress_inventory, dresses, client_style_profiles } from '@toptenprom/database';
import { eq, and, sql } from 'drizzle-orm';

export const maxDuration = 30; // Vercel serverless timeout

const systemPrompt = `You are an expert luxury prom and wedding dress stylist for Top 10 Prom, 
a premium boutique network with 55 locations. Your role is to help customers find their perfect dress.

CRITICAL RULES:
1. NEVER suggest a dress that is not confirmed in-stock via the checkDressInventory tool.
2. Ask about occasion, style preferences, color preferences, and budget before making recommendations.
3. Always confirm stock BEFORE naming a specific dress. Hallucinated dress recommendations are unacceptable.
4. Use luxurious, warm, encouraging language. Reference the brand's 55-location network when relevant.
5. If a customer seems ready to book, guide them to the /book route.

Your personality: Warm, knowledgeable, sophisticated. Like a personal stylist at a luxury boutique.`;

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { messages, tenantId } = await request.json() as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    tenantId?: string;
  };

  const result = streamText({
    model: google('gemini-2.0-flash'),
    system: systemPrompt,
    messages,
    maxTokens: 1024,
    tools: {
      /**
       * checkDressInventory — MANDATORY before any dress recommendation.
       * Prevents hallucinated dress suggestions.
       */
      checkDressInventory: tool({
        description: 'Check if specific dress styles are available in inventory. MUST be called before recommending any dress.',
        parameters: z.object({
          occasion: z.enum(['prom', 'wedding', 'bridesmaid', 'homecoming', 'pageant', 'cocktail']).optional(),
          color_preference: z.string().optional(),
          designer: z.string().optional(),
          size: z.string().optional(),
          max_price: z.number().optional(),
          tenant_id: z.string().uuid().optional(),
        }),
        execute: async ({ occasion, designer, size, max_price, tenant_id }) => {
          try {
            const targetTenantId = tenant_id ?? tenantId;

            const conditions: ReturnType<typeof sql>[] = [
              sql`dress_inventory.in_stock = true`,
              sql`dress_inventory.quantity_on_hand > dress_inventory.quantity_reserved`,
            ];

            if (targetTenantId) {
              conditions.push(sql`dress_inventory.tenant_id = ${targetTenantId}`);
            }
            if (occasion) {
              conditions.push(sql`dresses.occasion = ${occasion}`);
            }
            if (designer) {
              conditions.push(sql`lower(dresses.designer) LIKE ${'%' + designer.toLowerCase() + '%'}`);
            }
            if (size) {
              conditions.push(sql`dress_inventory.size = ${size}`);
            }
            if (max_price) {
              conditions.push(sql`dresses.retail_price <= ${max_price}`);
            }

            const available = await db
              .select({
                id: dresses.id,
                name: dresses.name,
                designer: dresses.designer,
                occasion: dresses.occasion,
                color_name: dress_inventory.color_name,
                size: dress_inventory.size,
                price: dresses.retail_price,
                image_url: sql<string>`dresses.image_urls->>'hero'`,
                quantity_available: sql<number>`dress_inventory.quantity_on_hand - dress_inventory.quantity_reserved`,
              })
              .from(dress_inventory)
              .leftJoin(dresses, eq(dress_inventory.dress_id, dresses.id))
              .where(and(...conditions))
              .limit(6)
              .orderBy(sql`RANDOM()`);

            return {
              available_count: available.length,
              dresses: available,
              message: available.length > 0
                ? `Found ${available.length} confirmed in-stock options.`
                : 'No matching dresses currently in stock for these criteria.',
            };
          } catch {
            return { available_count: 0, dresses: [], message: 'Inventory check temporarily unavailable.' };
          }
        },
      }),

      /**
       * saveStylePreference — Writes RAG preference data to client_style_profiles.
       */
      saveStylePreference: tool({
        description: 'Save customer style preferences to their profile for future personalization.',
        parameters: z.object({
          preferred_colors: z.array(z.string()).optional(),
          preferred_designers: z.array(z.string()).optional(),
          preferred_silhouettes: z.array(z.string()).optional(),
          budget_min: z.number().optional(),
          budget_max: z.number().optional(),
          summary: z.string().describe('Brief summary of the conversation for the profile'),
        }),
        execute: async ({ preferred_colors, preferred_designers, preferred_silhouettes, budget_min, budget_max, summary }) => {
          if (!user?.id) return { saved: false };

          try {
            await db
              .insert(client_style_profiles)
              .values({
                user_id: user.id,
                preferred_designers: preferred_designers ?? [],
                preferred_colors: (preferred_colors ?? []).map((c) => ({ name: c, hex: '' })),
                preferred_silhouettes: preferred_silhouettes ?? [],
                preferred_occasions: [],
                avoided_styles: [],
                budget_min: budget_min !== undefined ? String(budget_min) : undefined,
                budget_max: budget_max !== undefined ? String(budget_max) : undefined,
                raw_conversation_summary: summary,
                last_interaction_at: new Date(),
                interaction_count: 1,
              })
              .onConflictDoUpdate({
                target: client_style_profiles.user_id,
                set: {
                  preferred_designers: sql`COALESCE(${preferred_designers ?? null}::jsonb, client_style_profiles.preferred_designers)`,
                  raw_conversation_summary: summary,
                  last_interaction_at: new Date(),
                  interaction_count: sql`client_style_profiles.interaction_count + 1`,
                },
              });
            return { saved: true };
          } catch {
            return { saved: false };
          }
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}
