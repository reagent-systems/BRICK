# Simulated Endpoints & Mock Data Analysis

This document catalogs all simulated endpoints, mock data, and fake behaviors that need to be replaced with real implementations.

## 📋 Summary

**Total Simulated Areas:**
- 2 Mock Data Constants
- 1 Simulated API Service (with demo mode fallback)
- 4 Simulated User Interactions (setTimeout delays)
- 3 Hardcoded Static Data Sources
- 2 Placeholder UI Elements
- 1 Simulated IDE Connection

---

## 1. Mock Data Constants

### File: `constants.ts`

#### `MOCK_FEEDBACK` (Lines 3-44)
- **Type**: Static array of `FeedbackItem[]`
- **Purpose**: Provides fake social media feedback from X and Reddit
- **Contains**: 4 hardcoded feedback items with fake usernames, content, timestamps
- **Needs**: Real API integration to fetch feedback from:
  - X/Twitter API
  - Reddit API
  - Discord API (if applicable)
  - Email API (if applicable)

#### `SAMPLE_CODE_SNIPPET` (Lines 46-53)
- **Type**: Hardcoded string
- **Purpose**: Used as fallback code context when no real IDE selection is available
- **Needs**: Real IDE integration to capture actual code snippets from:
  - MCP (Model Context Protocol) connection
  - File watcher
  - Git commit hooks
  - Active editor selection

---

## 2. Simulated API Service

### File: `services/geminiService.ts`

#### `generateDraftContent()` - Demo Mode Fallback (Lines 37-47)
- **Simulation**: When `apiKey` is missing, returns a fake response after 1500ms delay
- **Returns**: Hardcoded demo content: `"[DEMO MODE - NO API KEY]\n\nJust shipped ${context}.\n\nThe flow is feeling good. #buildinpublic"`
- **Status**: ✅ **Real API call exists** when API key is present (uses Google GenAI SDK)
- **Needs**: 
  - Remove demo mode fallback
  - Add proper error handling for missing API key
  - Consider backend proxy for API key security

---

## 3. Simulated User Interactions (setTimeout)

### File: `components/Onboarding.tsx`

#### `handleConnect()` - OAuth Simulation (Lines 27-33)
- **Simulation**: `setTimeout` of 400ms to fake OAuth handshake delay
- **Location**: Line 30
- **Purpose**: Simulates connecting to X, Reddit, Discord, Email
- **Needs**: Real OAuth flows:
  - X/Twitter OAuth 2.0
  - Reddit OAuth 2.0
  - Discord OAuth 2.0
  - Email account linking (IMAP/OAuth)

### File: `components/SettingsPanel.tsx`

#### `handleAnalyze()` - Tone Calibration Simulation (Lines 29-33)
- **Simulation**: `setTimeout` of 3000ms to fake AI analysis delay
- **Location**: Line 32
- **Purpose**: Simulates analyzing user's writing style
- **Needs**: Real AI analysis endpoint:
  - Send tone context to backend
  - Analyze writing patterns
  - Store calibration results
  - Return success/failure status

---

## 4. Hardcoded Static Data

### File: `components/FeedbackPanel.tsx`

#### Initial State from `MOCK_FEEDBACK` (Line 8)
- **Simulation**: Initializes state with `MOCK_FEEDBACK` constant
- **Needs**: Real API endpoint to fetch feedback:
  - `GET /api/feedback` - Fetch all feedback items
  - `GET /api/feedback/:platform` - Filter by platform
  - `GET /api/feedback/:type` - Filter by type (bug, question, etc.)
  - WebSocket/SSE for real-time updates

### File: `components/DraftsPanel.tsx`

#### `SAMPLE_CODE_SNIPPET` Usage (Line 34)
- **Simulation**: Always uses hardcoded code snippet instead of real IDE context
- **Needs**: Real code context capture:
  - MCP connection to IDE
  - File watcher for changes
  - Git hook integration
  - Active editor selection API

#### `mediaUrl: "placeholder"` (Line 42)
- **Simulation**: Hardcoded placeholder string
- **Needs**: Real media attachment:
  - Screenshot capture API
  - Diff generation service
  - File upload endpoint

### File: `components/SettingsPanel.tsx`

#### `handleSimulateImport()` - Mock Tweet Import (Lines 18-27)
- **Simulation**: Injects hardcoded example tweets
- **Location**: Lines 20-23
- **Needs**: Real import functionality:
  - `GET /api/social/history/x` - Fetch user's X/Twitter history
  - `GET /api/social/history/reddit` - Fetch user's Reddit posts
  - Parse and format historical posts

#### Hardcoded Connection Status (Line 138)
- **Simulation**: Static "CONNECTED" text
- **Needs**: Real connection status check:
  - `GET /api/mcp/status` - Check MCP connection
  - `GET /api/mcp/port` - Get actual port number
  - WebSocket health check

#### Hardcoded Privacy Patterns (Lines 183-184)
- **Simulation**: Static badges for `.env` and `secrets/*`
- **Needs**: Real pattern management:
  - `GET /api/privacy/patterns` - Fetch user's ignore patterns
  - `POST /api/privacy/patterns` - Add new pattern
  - `DELETE /api/privacy/patterns/:id` - Remove pattern

#### Hardcoded Version Info (Line 195)
- **Simulation**: Static "BRICK v1.0.4-alpha"
- **Needs**: Dynamic version from package.json or API

### File: `components/SourceControlPanel.tsx`

#### Hardcoded Git Changes (Lines 5-9)
- **Simulation**: Static array of fake file changes
- **Needs**: Real git integration:
  - `GET /api/git/status` - Get current git status
  - `GET /api/git/changes` - Get modified files
  - `POST /api/git/commit` - Create commit
  - WebSocket for real-time change detection

#### Hardcoded Commit History (Lines 52-57)
- **Simulation**: Static commit messages
- **Needs**: Real git log:
  - `GET /api/git/log` - Get commit history
  - `GET /api/git/log/:limit` - Get last N commits

---

## 5. Placeholder UI Elements

### File: `components/DraftsPanel.tsx`

#### Media Attachment Placeholder (Lines 98-110)
- **Simulation**: Static JSX block showing fake "diff --git a/auth.ts"
- **Purpose**: Visual placeholder for code diff attachment
- **Needs**: Real diff generation:
  - Generate actual git diff
  - Capture screenshot
  - Upload to media service
  - Display real attachment

### File: `App.tsx`

#### IDE Connection Toggle (Lines 39-54)
- **Simulation**: Simple boolean toggle (`setIsIdeConnected(true)`)
- **Location**: Line 47
- **Needs**: Real MCP connection:
  - WebSocket connection to MCP server
  - Handshake protocol
  - Connection status monitoring
  - Error handling and reconnection

---

## 6. Simulated State Management

### File: `components/Onboarding.tsx`

#### Local State for Connections (Lines 19-25)
- **Simulation**: Component state only, not persisted
- **Needs**: Persistent storage:
  - Save to localStorage/IndexedDB
  - Sync with backend
  - `POST /api/connections` - Save connection status
  - `GET /api/connections` - Load saved connections

### File: `components/DraftsPanel.tsx`

#### Session History (Line 18)
- **Simulation**: In-memory React state, lost on refresh
- **Needs**: Persistent storage:
  - Save drafts to backend
  - `POST /api/drafts` - Save draft
  - `GET /api/drafts` - Load draft history
  - `PUT /api/drafts/:id` - Update draft
  - `DELETE /api/drafts/:id` - Delete draft

---

## 7. Missing Real Endpoints Summary

### Required Backend API Endpoints:

#### Social Media Integration
- `POST /api/auth/x/connect` - Initiate X OAuth
- `POST /api/auth/x/callback` - Handle X OAuth callback
- `POST /api/auth/reddit/connect` - Initiate Reddit OAuth
- `POST /api/auth/reddit/callback` - Handle Reddit OAuth callback
- `POST /api/auth/discord/connect` - Initiate Discord OAuth
- `POST /api/auth/discord/callback` - Handle Discord OAuth callback
- `POST /api/social/post` - Post to platform
- `GET /api/social/history/:platform` - Get posting history
- `GET /api/feedback` - Fetch feedback from all platforms
- `GET /api/feedback/:platform` - Filter feedback by platform
- `POST /api/feedback/:id/reply` - Reply to feedback

#### IDE/MCP Integration
- `GET /api/mcp/status` - Check MCP connection status
- `GET /api/mcp/port` - Get MCP server port
- `POST /api/mcp/connect` - Establish MCP connection
- `GET /api/mcp/context` - Get current code context
- `WebSocket /ws/mcp` - Real-time MCP events

#### Git Integration
- `GET /api/git/status` - Get git status
- `GET /api/git/changes` - Get modified files
- `GET /api/git/log` - Get commit history
- `POST /api/git/commit` - Create commit
- `GET /api/git/diff/:file` - Get file diff

#### Folder Watcher
- `POST /api/watcher/add` - Add folder to watch list (via Capacitor folder picker)
- `GET /api/watcher/list` - Get list of watched folders
- `DELETE /api/watcher/:id` - Remove folder from watch list
- `WebSocket /ws/watcher` - Real-time file change events from watched folders

#### Drafts Management
- `POST /api/drafts` - Create/save draft
- `GET /api/drafts` - List all drafts
- `GET /api/drafts/:id` - Get specific draft
- `PUT /api/drafts/:id` - Update draft
- `DELETE /api/drafts/:id` - Delete draft

#### Settings & Configuration
- `POST /api/settings/tone` - Save tone calibration
- `GET /api/settings/tone` - Get tone calibration
- `POST /api/settings/privacy/patterns` - Add ignore pattern
- `GET /api/settings/privacy/patterns` - Get ignore patterns
- `DELETE /api/settings/privacy/patterns/:id` - Remove pattern
- `POST /api/settings/protocols` - Update protocol settings

#### Media & Attachments
- `POST /api/media/upload` - Upload screenshot/diff
- `GET /api/media/:id` - Get media file
- `POST /api/media/diff` - Generate code diff

---

## 8. Environment Variables Needed

- `GEMINI_API_KEY` - ✅ Already configured
- `X_API_KEY` - Twitter/X API credentials
- `X_API_SECRET` - Twitter/X API secret
- `REDDIT_CLIENT_ID` - Reddit OAuth client ID
- `REDDIT_CLIENT_SECRET` - Reddit OAuth client secret
- `DISCORD_CLIENT_ID` - Discord OAuth client ID
- `DISCORD_CLIENT_SECRET` - Discord OAuth client secret
- `MCP_SERVER_URL` - MCP server endpoint
- `MCP_SERVER_PORT` - MCP server port
- `BACKEND_API_URL` - Backend API base URL

---

## 9. Real-Time Features Needed

- WebSocket connection for MCP events
- WebSocket connection for folder watcher events (file changes in watched folders)
- WebSocket connection for feedback updates
- Server-Sent Events (SSE) as alternative to WebSockets

---

## 10. Security Considerations

- Move API keys to backend (never expose in frontend)
- Implement proper OAuth flows (never expose secrets)
- Add authentication/authorization for API endpoints
- Encrypt sensitive data in storage
- Validate all user inputs
- Rate limiting on API endpoints

