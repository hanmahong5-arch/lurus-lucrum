/**
 * SSE re-framer for upstream LLM streams.
 *
 * Wraps a raw OpenAI-compatible chat-completion SSE stream and emits a
 * normalized stream that the chat UI hook can consume. Adds three things
 * the prior hand-rolled TransformStream missed:
 *
 *   1. **Cross-chunk line buffering** — `data:` lines that split across
 *      network chunks no longer get JSON.parse-rejected and silently dropped.
 *
 *   2. **Mid-stream upstream errors** — when newapi emits `data: {"error":...}`
 *      mid-stream (gateway throttle, model channel down, etc.) we translate
 *      it into a canonical error frame instead of letting the connection just
 *      stop, leaving the user staring at a half-rendered answer.
 *
 *   3. **Truncation detection** — if the upstream socket closes WITHOUT
 *      sending `[DONE]`, that's an unfinished response. We surface it as a
 *      "stream truncated" error frame so the UI can offer a retry.
 *
 * Output protocol (consumed by `use-streaming-chat`):
 *   data: {"content":"…"}\n\n      — incremental text
 *   data: {"error":{...}}\n\n       — terminal error (UI shows banner)
 *   data: [DONE]\n\n                — clean end
 *
 * The `error` payload mirrors the JSON-route error shape so the UI can
 * render the same banner/recoveryActions chrome regardless of transport.
 *
 * @module lib/llm/sse-transform
 */

export interface DownstreamErrorPayload {
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly severity: 'error' | 'warning';
  readonly recoveryActions?: ReadonlyArray<{ type: string; label: string; href?: string }>;
  // Optional raw upstream error for debugging — never surfaced to UI.
  readonly upstream?: unknown;
}

export interface SseTransformOptions {
  /**
   * Caller-owned abort signal. Signals client disconnect — we close the
   * downstream cleanly without an error frame because the user already
   * went away (any UI is gone).
   */
  readonly signal?: AbortSignal;
  /**
   * Server-side content tap. Invoked for every text chunk as it is forwarded
   * downstream. Lets the route accumulate the full response (e.g. for cache
   * writes) without parsing the SSE stream a second time. Throws are
   * swallowed so a buggy callback can never break the user-facing stream.
   */
  readonly onContent?: (chunk: string) => void;
  /**
   * Called exactly once when the stream terminates cleanly with `[DONE]`.
   * NOT called on error frames or truncation — only on the happy path. Use
   * to persist the assembled response. Throws are swallowed.
   */
  readonly onComplete?: () => void;
}

const ENC = new TextEncoder();
const DEC = new TextDecoder();

const errFrame = (e: DownstreamErrorPayload): Uint8Array =>
  ENC.encode(`data: ${JSON.stringify({ error: e })}\n\n`);
const contentFrame = (text: string): Uint8Array =>
  ENC.encode(`data: ${JSON.stringify({ content: text })}\n\n`);
const doneFrame = (): Uint8Array => ENC.encode('data: [DONE]\n\n');

const STREAM_TRUNCATED: DownstreamErrorPayload = {
  code: 'ADVISOR_STREAM_TRUNCATED',
  title: 'AI 响应中断',
  description: '与 AI 服务的连接在响应完成前断开，请重试。',
  severity: 'error',
  recoveryActions: [
    { type: 'retry', label: '重试' },
    { type: 'custom', label: '简化问题' },
  ],
};

const STREAM_GATEWAY_ERROR = (upstream?: unknown): DownstreamErrorPayload => ({
  code: 'ADVISOR_STREAM_GATEWAY',
  title: 'AI 服务返回错误',
  description: '上游 AI 网关在生成过程中报错，请重试或换一种提问方式。',
  severity: 'error',
  recoveryActions: [
    { type: 'retry', label: '重试' },
    { type: 'custom', label: '换一种提问方式' },
  ],
  upstream,
});

const STREAM_IO_ERROR: DownstreamErrorPayload = {
  code: 'ADVISOR_STREAM_IO',
  title: 'AI 流连接异常',
  description: '与 AI 网关的网络连接异常中断，请检查网络后重试。',
  severity: 'error',
  recoveryActions: [
    { type: 'retry', label: '重试' },
  ],
};

interface ParsedDelta {
  readonly content: string | null;
  readonly upstreamError: unknown | null;
}

/**
 * Best-effort parse of an OpenAI-compatible streaming `data:` JSON payload.
 * Returns nullish fields rather than throwing — corrupt frames are ignored
 * (the broader transform decides whether to bail or continue).
 */
function parseDataPayload(payload: string): ParsedDelta {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return { content: null, upstreamError: null };
  }
  if (parsed === null || typeof parsed !== 'object') {
    return { content: null, upstreamError: null };
  }
  const obj = parsed as { choices?: unknown; error?: unknown };
  // Both newapi and OpenAI wrap mid-stream errors as `{error: {...}}` (or
  // sometimes `{error: "string"}`). Treat any truthy `error` field as a
  // terminal upstream error.
  if (obj.error) {
    return { content: null, upstreamError: obj.error };
  }
  if (Array.isArray(obj.choices) && obj.choices.length > 0) {
    const choice = obj.choices[0] as { delta?: { content?: unknown } } | undefined;
    const delta = choice?.delta?.content;
    if (typeof delta === 'string' && delta.length > 0) {
      return { content: delta, upstreamError: null };
    }
  }
  return { content: null, upstreamError: null };
}

/**
 * Strip the `data:` prefix (with or without the optional space per RFC 6202)
 * and trim. Returns null for non-data lines (`event:`, `:` comments, blanks).
 */
function extractDataPayload(line: string): string | null {
  if (!line.startsWith('data:')) return null;
  // RFC 6202 says one optional space after the colon; some providers omit it.
  const rest = line.startsWith('data: ') ? line.slice(6) : line.slice(5);
  return rest.trim();
}

/**
 * Translate an upstream OpenAI-compatible streaming `Response.body` into a
 * normalized SSE stream for the chat UI. The returned stream emits frames
 * exclusively in the protocol documented at the top of this file.
 */
export function translateUpstreamSseStream(
  upstream: ReadableStream<Uint8Array>,
  options?: SseTransformOptions,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      let buffer = '';
      let sawDone = false;
      // True once we've emitted a terminal frame (error or [DONE]). Prevents
      // double-emitting if multiple terminal conditions race.
      let closed = false;

      const closeWith = (frame: Uint8Array): void => {
        if (closed) return;
        closed = true;
        controller.enqueue(frame);
        controller.close();
      };

      const handlePayload = (payload: string): boolean => {
        // Returns true if processing should stop (terminal frame emitted).
        if (payload === '[DONE]') {
          sawDone = true;
          return true;
        }
        const { content, upstreamError } = parseDataPayload(payload);
        if (upstreamError !== null) {
          closeWith(errFrame(STREAM_GATEWAY_ERROR(upstreamError)));
          return true;
        }
        if (content !== null) {
          if (!closed) {
            controller.enqueue(contentFrame(content));
            // Best-effort tap — never let a callback exception poison the
            // stream the user is actively consuming.
            try {
              options?.onContent?.(content);
            } catch {
              /* swallow */
            }
          }
        }
        return false;
      };

      try {
        while (!closed) {
          if (options?.signal?.aborted) {
            // Caller is gone — silent close, no error frame (no UI to render it).
            if (!closed) {
              closed = true;
              controller.close();
            }
            return;
          }
          const { done, value } = await reader.read();
          if (done) break;
          buffer += DEC.decode(value, { stream: true });
          // SSE messages end with `\n\n` (blank line). We process line-by-line;
          // a single message can span chunks, so the trailing partial stays
          // in `buffer` until completed.
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const payload = extractDataPayload(line);
            if (payload === null) continue;
            if (handlePayload(payload)) {
              if (sawDone && !closed) {
                closeWith(doneFrame());
                // Mid-stream `[DONE]` exit path: notify the server-side tap
                // here too, otherwise onComplete only fires for streams that
                // close *after* the upstream EOF arrives.
                try {
                  options?.onComplete?.();
                } catch {
                  /* swallow */
                }
              }
              return;
            }
          }
        }
        // Stream ended. Drain any final partial line that has no trailing \n.
        if (!closed && buffer.length > 0) {
          const payload = extractDataPayload(buffer.trimEnd());
          if (payload !== null) handlePayload(payload);
        }
        if (closed) return;
        if (sawDone) {
          closeWith(doneFrame());
          // Clean termination: notify the server-side tap so it can persist
          // the assembled body. Swallow throws — callback bugs must not
          // surface as stream errors after we've already emitted [DONE].
          try {
            options?.onComplete?.();
          } catch {
            /* swallow */
          }
        } else {
          closeWith(errFrame(STREAM_TRUNCATED));
        }
      } catch (err) {
        // AbortError from caller signal: silent close.
        if ((err as Error)?.name === 'AbortError' || options?.signal?.aborted) {
          if (!closed) {
            closed = true;
            controller.close();
          }
          return;
        }
        closeWith(errFrame(STREAM_IO_ERROR));
      } finally {
        try {
          reader.releaseLock();
        } catch {
          /* lock already released or stream errored */
        }
      }
    },
  });
}
