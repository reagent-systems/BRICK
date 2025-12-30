
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Platform } from "../types";

// NOTE: In a real app, this would be a secure backend call or use an ephemeral token.
// For this demo, we assume process.env.API_KEY is available (injected by the environment).
const apiKey = process.env.API_KEY || ''; 

const ai = new GoogleGenAI({ apiKey });

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

export const generateDraftContent = async (
  platform: Platform,
  context: string,
  codeSnippet?: string,
  toneContext?: string
): Promise<GeneratedContent> => {
  if (!apiKey) {
     // Fallback for demo without key
     return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                title: platform === Platform.REDDIT ? "Update: " + context : undefined,
                content: `[DEMO MODE - NO API KEY]\n\nJust shipped ${context}.\n\nThe flow is feeling good. #buildinpublic`
            })
        }, 1500);
     });
  }

  try {
    const prompt = `
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
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
    console.error("Gemini Generation Error:", error);
    return {
      title: "Error Generating Draft",
      content: "Could not generate draft. Please check your API Key configuration."
    };
  }
};
