
export enum Platform {
  ALL = 'ALL',
  X = 'X',
  REDDIT = 'REDDIT',
  EMAIL = 'EMAIL',
  DISCORD = 'DISCORD'
}

export interface Draft {
  id: string;
  timestamp: number;
  platform: Platform;
  content: string;
  title?: string; // For Reddit
  mediaUrl?: string; // Placeholder for screenshots
  posted: boolean;
}

export interface FeedbackItem {
  id: string;
  platform: Platform;
  username: string;
  content: string;
  timestamp: number;
  type: 'question' | 'bug' | 'request' | 'positive' | 'general';
  threadId: string;
  threadTitle: string;
}

export interface UserConfig {
  xConnected: boolean;
  redditConnected: boolean;
  emailConnected: boolean;
  discordConnected: boolean;
  setupComplete: boolean;
}
