/**
 * Batch Queue for Draft Generation
 *
 * When multiple input events arrive in quick succession (e.g., rapid file saves,
 * multiple commits), this queue batches them into a single LLM call with
 * instructions to generate multiple outputs. The combined response is then
 * split back into individual drafts.
 *
 * This reduces cost because:
 * - Fewer API calls = less per-request overhead
 * - Shared system prompt tokens across multiple outputs
 * - Users going through our service get better per-credit value
 */

import { Platform, InputEvent } from '../types';
import { generateDraftContent } from './geminiService';

// ─── Config ──────────────────────────────────────────────────────────────────

const BATCH_WINDOW_MS = 3000;  // Wait this long for more events before processing
const MAX_BATCH_SIZE = 5;       // Max events in a single batch

// ─── Types ───────────────────────────────────────────────────────────────────

interface QueuedEvent {
  event: InputEvent;
  platform: Platform;
  toneContext: string;
  resolve: (result: { title?: string; content: string }) => void;
  reject: (error: Error) => void;
}

// ─── State ───────────────────────────────────────────────────────────────────

let queue: QueuedEvent[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;
let processing = false;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Queue an input event for batched draft generation.
 * Returns a promise that resolves with the generated content.
 *
 * If only one event arrives within the batch window, it's processed normally.
 * If multiple arrive, they're combined into one LLM call.
 */
export function queueDraftGeneration(
  event: InputEvent,
  platform: Platform,
  toneContext: string,
): Promise<{ title?: string; content: string }> {
  return new Promise((resolve, reject) => {
    queue.push({ event, platform, toneContext, resolve, reject });

    // If we've hit max batch size, process immediately
    if (queue.length >= MAX_BATCH_SIZE) {
      flushQueue();
      return;
    }

    // Otherwise, (re)set the debounce timer
    if (batchTimer) clearTimeout(batchTimer);
    batchTimer = setTimeout(flushQueue, BATCH_WINDOW_MS);
  });
}

/**
 * Get the current queue size (for UI status display).
 */
export function getQueueSize(): number {
  return queue.length;
}

// ─── Internal ────────────────────────────────────────────────────────────────

async function flushQueue() {
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }

  if (queue.length === 0 || processing) return;

  // Take the current batch
  const batch = queue.splice(0, MAX_BATCH_SIZE);
  processing = true;

  try {
    if (batch.length === 1) {
      // Single event — process normally (no batching overhead)
      const item = batch[0];
      const result = await generateDraftContent(
        item.platform,
        item.event.context,
        item.event.codeSnippet,
        item.toneContext,
      );
      item.resolve(result);
    } else {
      // Multiple events — combine into a single prompt
      await processBatch(batch);
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Batch processing failed');
    for (const item of batch) {
      item.reject(err);
    }
  } finally {
    processing = false;

    // If more events arrived during processing, flush again
    if (queue.length > 0) {
      flushQueue();
    }
  }
}

async function processBatch(batch: QueuedEvent[]) {
  // Build a combined context string with numbered sections
  const combinedContext = batch
    .map((item, i) => {
      const source = item.event.source.toUpperCase();
      return `[EVENT ${i + 1} - ${source}]: ${item.event.context}${
        item.event.codeSnippet ? `\nCode:\n${item.event.codeSnippet.slice(0, 500)}` : ''
      }`;
    })
    .join('\n\n---\n\n');

  // Use the first item's platform and tone as the primary target
  // (in practice, they're usually the same since events arrive on the same screen)
  const primaryPlatform = batch[0].platform;
  const toneContext = batch[0].toneContext;

  // Generate with a special instruction to produce multiple outputs
  const batchPrompt = `You have ${batch.length} recent coding events. Generate a SEPARATE social media post for EACH event.

Separate each post with the delimiter: <<<SPLIT>>>

${combinedContext}`;

  const result = await generateDraftContent(
    primaryPlatform,
    batchPrompt,
    undefined, // code snippets already embedded in context
    toneContext,
  );

  // Split the combined response back into individual results
  const parts = result.content.split('<<<SPLIT>>>').map(s => s.trim()).filter(Boolean);

  for (let i = 0; i < batch.length; i++) {
    if (i < parts.length) {
      batch[i].resolve({
        title: result.title,
        content: parts[i],
      });
    } else {
      // Fewer outputs than inputs — use the last available
      batch[i].resolve({
        title: result.title,
        content: parts[parts.length - 1] || result.content,
      });
    }
  }
}
