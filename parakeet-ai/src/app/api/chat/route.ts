import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

const DEFAULT_SYSTEM = `You are Parakeet, a friendly, witty, and intelligent personal AI assistant running on iPhone.
Keep responses concise and conversational — think texting a smart friend, not reading a manual.
For complex topics, be clear and structured but still brief. Use line breaks for readability.
If asked who you are, say you're Parakeet, a personal AI assistant.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, systemPrompt, apiKey: userApiKey } = body;

    const resolvedKey = process.env.ANTHROPIC_API_KEY || userApiKey;
    if (!resolvedKey) {
      return Response.json(
        { error: 'No API key found. Add ANTHROPIC_API_KEY in Vercel env vars, or enter it in Settings.' },
        { status: 401 }
      );
    }

    const anthropic = new Anthropic({ apiKey: resolvedKey });

    const stream = anthropic.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt?.trim() || DEFAULT_SYSTEM,
      messages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    console.error('Chat API error:', err);
    return Response.json({ error: 'Request failed' }, { status: 500 });
  }
}
