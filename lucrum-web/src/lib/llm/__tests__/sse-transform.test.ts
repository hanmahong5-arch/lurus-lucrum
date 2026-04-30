/**
 * Tests for translateUpstreamSseStream — verifies the chat-stream re-framer
 * handles cross-chunk line buffering, mid-stream upstream errors, and
 * truncation. The chat UI relies on these guarantees to give the user a
 * decisive "done", "error", or "retry" signal instead of staring at a half-
 * rendered message.
 */

import { describe, expect, it } from 'vitest';
import { translateUpstreamSseStream } from '../sse-transform';

const ENC = new TextEncoder();
const DEC = new TextDecoder();

function makeUpstream(chunks: ReadonlyArray<string | Uint8Array>): ReadableStream<Uint8Array> {
  const queue = chunks.map((c) => (typeof c === 'string' ? ENC.encode(c) : c));
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (queue.length === 0) {
        controller.close();
        return;
      }
      controller.enqueue(queue.shift()!);
    },
  });
}

function makeFailingUpstream(chunksBeforeError: ReadonlyArray<string>): ReadableStream<Uint8Array> {
  const queue = chunksBeforeError.map((c) => ENC.encode(c));
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (queue.length === 0) {
        controller.error(new Error('socket reset'));
        return;
      }
      controller.enqueue(queue.shift()!);
    },
  });
}

async function collectFrames(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const reader = stream.getReader();
  let buffer = '';
  const frames: string[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += DEC.decode(value, { stream: true });
  }
  // Frames are separated by \n\n. Filter empties.
  for (const f of buffer.split('\n\n')) {
    const t = f.trim();
    if (t) frames.push(t);
  }
  return frames;
}

function dataPayload(frame: string): unknown {
  // each frame is `data: <payload>` (one line)
  const stripped = frame.startsWith('data: ') ? frame.slice(6) : frame.slice(5);
  if (stripped.trim() === '[DONE]') return '[DONE]';
  return JSON.parse(stripped);
}

describe('translateUpstreamSseStream', () => {
  it('translates a clean stream into content frames + [DONE]', async () => {
    const upstream = makeUpstream([
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: [DONE]\n\n',
    ]);
    const frames = await collectFrames(translateUpstreamSseStream(upstream));
    expect(frames).toHaveLength(3);
    expect(dataPayload(frames[0]!)).toEqual({ content: 'Hello' });
    expect(dataPayload(frames[1]!)).toEqual({ content: ' world' });
    expect(dataPayload(frames[2]!)).toBe('[DONE]');
  });

  it('buffers a data line split across two upstream chunks', async () => {
    // Emit half of a JSON payload, then the rest. Naive split-by-chunk
    // implementations would JSON.parse-fail on chunk 1 and silently drop the
    // content. We expect it to reassemble correctly.
    const upstream = makeUpstream([
      'data: {"choices":[{"delta":{"con',
      'tent":"Hello"}}]}\n\ndata: [DONE]\n\n',
    ]);
    const frames = await collectFrames(translateUpstreamSseStream(upstream));
    expect(frames).toHaveLength(2);
    expect(dataPayload(frames[0]!)).toEqual({ content: 'Hello' });
    expect(dataPayload(frames[1]!)).toBe('[DONE]');
  });

  it('translates a mid-stream upstream error into a canonical error frame', async () => {
    const upstream = makeUpstream([
      'data: {"choices":[{"delta":{"content":"A"}}]}\n\n',
      'data: {"error":{"message":"channel down","type":"upstream"}}\n\n',
      // Anything after error must be dropped — we close immediately.
      'data: {"choices":[{"delta":{"content":"B"}}]}\n\n',
      'data: [DONE]\n\n',
    ]);
    const frames = await collectFrames(translateUpstreamSseStream(upstream));
    expect(frames).toHaveLength(2);
    expect(dataPayload(frames[0]!)).toEqual({ content: 'A' });
    const err = dataPayload(frames[1]!) as { error: { code: string; title: string } };
    expect(err.error.code).toBe('ADVISOR_STREAM_GATEWAY');
    expect(err.error.title).toContain('AI');
    // No [DONE] after error frame — error is itself terminal.
    const lastIsDone = frames.some((f) => dataPayload(f) === '[DONE]');
    expect(lastIsDone).toBe(false);
  });

  it('emits a truncation error when stream closes without [DONE]', async () => {
    const upstream = makeUpstream([
      'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n',
      // No [DONE]; just close.
    ]);
    const frames = await collectFrames(translateUpstreamSseStream(upstream));
    expect(frames).toHaveLength(2);
    expect(dataPayload(frames[0]!)).toEqual({ content: 'partial' });
    const err = dataPayload(frames[1]!) as { error: { code: string } };
    expect(err.error.code).toBe('ADVISOR_STREAM_TRUNCATED');
  });

  it('emits an IO error when the upstream errors mid-stream', async () => {
    const upstream = makeFailingUpstream([
      'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
    ]);
    const frames = await collectFrames(translateUpstreamSseStream(upstream));
    // First a content frame, then the error frame.
    expect(frames.length).toBeGreaterThanOrEqual(2);
    const last = dataPayload(frames[frames.length - 1]!) as { error: { code: string } };
    expect(last.error.code).toBe('ADVISOR_STREAM_IO');
  });

  it('silently closes (no error frame) when the caller signal is pre-aborted', async () => {
    const upstream = makeUpstream([
      'data: {"choices":[{"delta":{"content":"unread"}}]}\n\n',
      'data: [DONE]\n\n',
    ]);
    const ctrl = new AbortController();
    ctrl.abort();
    const frames = await collectFrames(translateUpstreamSseStream(upstream, { signal: ctrl.signal }));
    // No frames — we close immediately on the next iteration.
    expect(frames).toHaveLength(0);
  });

  it('handles `data:` without the optional space (RFC 6202)', async () => {
    const upstream = makeUpstream([
      'data:{"choices":[{"delta":{"content":"x"}}]}\n\n',
      'data:[DONE]\n\n',
    ]);
    const frames = await collectFrames(translateUpstreamSseStream(upstream));
    expect(dataPayload(frames[0]!)).toEqual({ content: 'x' });
    expect(dataPayload(frames[1]!)).toBe('[DONE]');
  });

  it('ignores non-data SSE lines (comments, event-name lines)', async () => {
    const upstream = makeUpstream([
      ': keepalive\n\n',
      'event: ignored\ndata: {"choices":[{"delta":{"content":"y"}}]}\n\n',
      'data: [DONE]\n\n',
    ]);
    const frames = await collectFrames(translateUpstreamSseStream(upstream));
    // Even with an `event:` line, the `data:` payload still parses.
    expect(dataPayload(frames[0]!)).toEqual({ content: 'y' });
    expect(dataPayload(frames[1]!)).toBe('[DONE]');
  });
});
