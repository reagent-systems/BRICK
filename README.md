# BRICK

**Code. Share. Listen.**  
*A brutalist, flow-preserving tool for building in public directly from your IDE.*

DevFlow Studio is a developer-first dashboard designed to reduce the friction of "building in public." By connecting directly to your development environment via the Model Context Protocol (MCP), it observes your coding activity and uses Google's Gemini models to draft social media updates, changelogs, and technical posts automatically.

## ⚡ Features

*   **Brutalist Aesthetics**: High-contrast, keyboard-centric UI designed for dark mode environments.
*   **Context-Aware Drafting**: Uses `gemini-3-flash` to analyze code snippets and generate platform-specific posts (X/Twitter threads, Reddit posts).
*   **Tone Calibration**: Train the AI on your previous posts to mimic your specific writing style and vocabulary.
*   **Unified Feedback Loop**: Aggregates comments, bug reports, and feature requests from social platforms into a single stream.
*   **Privacy-First Design**: Local processing of drafts with explicit "Post" confirmation.

## 🛠️ Tech Stack

*   **Frontend**: React 19
*   **Styling**: Tailwind CSS
*   **Icons**: Lucide React
*   **AI**: Google GenAI SDK (`@google/genai`)
*   **Font**: JetBrains Mono

## 🚀 Getting Started

1.  **Install Dependencies**
    *(Note: This is a web preview, dependencies are loaded via ESM in `index.html`)*

2.  **Environment Setup**
    The app uses the Google Gemini API.
    *Demo Mode*: If no key is found, the app simulates API responses for testing UI flow.

3.  **Run Application**
    Launch the development server to view the studio.

## 📖 Usage Guide

1.  **Onboarding**: Click "Connect X" and "Connect Reddit" to simulate OAuth linking. Click "Start Building".
2.  **Connection**: In the main view, click "Establish MCP Link" to simulate a handshake with your local IDE agent.
3.  **Tone Settings**: Go to **Settings**, paste your previous tweets or click "Import" to calibrate the AI's voice.
4.  **Drafting**: 
    *   Navigate to the **Drafts** tab.
    *   The system (simulated) detects code changes and generates post copy using your calibrated tone.
    *   Select a platform (X or Reddit) and click "Post" to save to session history.
5.  **Feedback**:
    *   Navigate to the **Feedback** tab.
    *   Filter incoming user comments by type (Bug, Question, Positive).

---

*Built with flow state in mind.*
