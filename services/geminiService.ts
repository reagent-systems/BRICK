/**
 * Gemini AI Service (Dual-Mode)
 *
 * Two modes:
 *   1. AUTHENTICATED (Firebase AI): User is signed in with credits.
 *      Uses Firebase AI Logic — no API key in app, credits deducted per use.
 *   2. LOCAL (direct SDK): User supplies their own Gemini API key.
 *      Uses @google/genai directly — no credits, no account needed.
 *
 * If neither mode is available, returns a message prompting the user to
 * either sign in or add their own API key.
 */

import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Platform } from "../types";
import { isFirebaseConfigured, getFirebaseApp } from "./firebaseConfig";
import { getAuth } from "firebase/auth";
import { deductCredits } from "./creditService";

// ─── Local API Key Management ────────────────────────────────────────────────

const STORAGE_KEY = 'brick_gemini_api_key';

export function getApiKey(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  return process.env.API_KEY || process.env.GEMINI_API_KEY || '';
}

export function setApiKey(key: string): void {
  if (key.trim()) {
    localStorage.setItem(STORAGE_KEY, key.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}

// ─── Clients ─────────────────────────────────────────────────────────────────

// Local (direct SDK) client — lazy singleton
let localCachedKey = '';
let localClient: GoogleGenAI | null = null;

function getLocalClient(): GoogleGenAI | null {
  const key = getApiKey();
  if (!key) return null;
  if (key !== localCachedKey || !localClient) {
    localClient = new GoogleGenAI({ apiKey: key });
    localCachedKey = key;
  }
  return localClient;
}

// Firebase AI client — lazy singleton
let firebaseAiModel: any = null;
let firebaseAiInitialized = false;

async function getFirebaseAiModel() {
  if (firebaseAiModel && firebaseAiInitialized) return firebaseAiModel;

  try {
    const { getAI, getGenerativeModel, GoogleAIBackend } = await import("firebase/ai");
    const app = getFirebaseApp();
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    firebaseAiModel = getGenerativeModel(ai, { model: "gemini-2.5-flash" });
    firebaseAiInitialized = true;
    return firebaseAiModel;
  } catch (error) {
    console.error("[Gemini] Failed to initialize Firebase AI:", error);
    firebaseAiInitialized = false;
    return null;
  }
}

// ─── Mode Detection ──────────────────────────────────────────────────────────

type AiMode = 'firebase' | 'local' | 'none';

function detectMode(): AiMode {
  // If user has their own API key, always use local (free for them, no credits)
  if (hasApiKey()) return 'local';

  // If Firebase is configured and user is signed in, use Firebase AI
  if (isFirebaseConfigured()) {
    try {
      const auth = getAuth(getFirebaseApp());
      if (auth.currentUser) return 'firebase';
    } catch {
      // Firebase not ready
    }
  }

  return 'none';
}

// ─── Schema ──────────────────────────────────────────────────────────────────

interface GeneratedContent {
  title?: string;
  content: string;
}

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "A catchy title, required for Reddit, optional for X and Discord."
    },
    content: {
      type: Type.STRING,
      description: "The body of the social media post. For X, use newlines to separate thread tweets if long."
    }
  },
  required: ["content"]
};

// ─── Prompt Builder ──────────────────────────────────────────────────────────

function buildPrompt(platform: Platform, context: string, codeSnippet?: string, toneContext?: string): string {
  return `
You are BRICK, an AI assistant for a developer.
Task: Write a social media post for ${platform} based on the following recent coding activity.

Activity Context: ${context}
${codeSnippet ? `Related Code:\n${codeSnippet}` : ''}

${toneContext ? `
IMPORTANT - USER TONE/STYLE:
Emulate the writing style, vocabulary, and sentence structure found in these examples provided by the user:
"""
${toneContext}
"""
` : ''}

Style Guide (if not overridden by User Tone above):
- Brutalist, concise, technical but accessible.
- Lowercase aesthetics preferred but use proper nouns.
- Use 1-2 emojis max.
- For X: If it's long, format it as a thread separated by double newlines.
- For Reddit: Provide a strong title and a markdown formatted body.
- For Discord: Use Discord-flavored markdown (code blocks, bolding). Keep it community-focused. Imagine it's for a #changelog or #dev-log channel.

Respond with JSON: { "title": "...", "content": "..." }
`;
}

// ─── Generation (unified entry point) ────────────────────────────────────────

export const generateDraftContent = async (
  platform: Platform,
  context: string,
  codeSnippet?: string,
  toneContext?: string
): Promise<GeneratedContent> => {
  const mode = detectMode();

  if (mode === 'none') {
    return {
      content: '[NO AI CONFIGURED]\n\nSign in to use BRICK AI credits, or add your own Gemini API key in Settings → AI Engine.',
    };
  }

  const prompt = buildPrompt(platform, context, codeSnippet, toneContext);

  if (mode === 'local') {
    return generateLocal(platform, prompt);
  }

  return generateFirebase(platform, prompt);
};

// ─── Local Mode (direct SDK) ─────────────────────────────────────────────────

async function generateLocal(_platform: Platform, prompt: string): Promise<GeneratedContent> {
  const client = getLocalClient();
  if (!client) {
    return { content: 'API key is set but client failed to initialize.' };
  }

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return JSON.parse(text) as GeneratedContent;
  } catch (error) {
    console.error("[Gemini/Local] Error:", error);
    return {
      title: "Error Generating Draft",
      content: "Could not generate draft. Check your API key in Settings → AI Engine.",
    };
  }
}

// ─── Firebase Mode (Firebase AI Logic + credit deduction) ────────────────────

async function generateFirebase(_platform: Platform, prompt: string): Promise<GeneratedContent> {
  // Check & deduct credits first
  const auth = getAuth(getFirebaseApp());
  const uid = auth.currentUser?.uid;
  if (!uid) {
    return { content: 'Not signed in. Sign in to use BRICK AI credits.' };
  }

  const hasCredits = await deductCredits(uid, 1, 'Draft generation');
  if (!hasCredits) {
    return {
      content: '[INSUFFICIENT CREDITS]\n\nYou\'re out of credits. Top up in the credit meter (left sidebar) to continue generating drafts.',
    };
  }

  try {
    const model = await getFirebaseAiModel();
    if (!model) {
      return { content: 'Firebase AI is not available. Add your own API key in Settings → AI Engine.' };
    }

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    if (!text) throw new Error("No response from Firebase AI");

    // Firebase AI returns plain text; try to parse as JSON
    try {
      return JSON.parse(text) as GeneratedContent;
    } catch {
      // Model returned plain text instead of JSON — wrap it
      return { content: text };
    }
  } catch (error) {
    console.error("[Gemini/Firebase] Error:", error);
    // Refund the credit on failure
    const { addCredits } = await import('./creditService');
    await addCredits(uid, 1, 'Refund: generation failed').catch(() => {});
    return {
      title: "Error Generating Draft",
      content: "AI generation failed. Your credit has been refunded. Please try again.",
    };
  }
}
