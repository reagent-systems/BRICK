/**
 * Unified OAuth Service Layer
 * Provides a common interface for OAuth flows across all platforms
 */

import { initiateXOAuth, handleXOAuthCallback, isXConnected, disconnectX } from './xOAuthService';
import { hasValidTokens } from './tokenStorageService';

export type Platform = 'x' | 'reddit' | 'discord' | 'email';

/**
 * Initiate OAuth flow for a platform
 */
export async function initiateOAuth(platform: Platform): Promise<void> {
  switch (platform) {
    case 'x':
      await initiateXOAuth();
      break;
    case 'reddit':
      // TODO: Implement Reddit OAuth
      throw new Error('Reddit OAuth not yet implemented');
    case 'discord':
      // TODO: Implement Discord OAuth
      throw new Error('Discord OAuth not yet implemented');
    case 'email':
      // TODO: Implement Email OAuth
      throw new Error('Email OAuth not yet implemented');
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

/**
 * Handle OAuth callback for a platform
 */
export async function handleOAuthCallback(
  platform: Platform,
  code: string,
  state: string
): Promise<void> {
  switch (platform) {
    case 'x':
      await handleXOAuthCallback(code, state);
      break;
    case 'reddit':
      // TODO: Implement Reddit callback
      throw new Error('Reddit OAuth callback not yet implemented');
    case 'discord':
      // TODO: Implement Discord callback
      throw new Error('Discord OAuth callback not yet implemented');
    case 'email':
      // TODO: Implement Email callback
      throw new Error('Email OAuth callback not yet implemented');
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

/**
 * Check if a platform is connected
 */
export async function getConnectionStatus(platform: Platform): Promise<boolean> {
  switch (platform) {
    case 'x':
      return await isXConnected();
    case 'reddit':
      return await hasValidTokens('reddit');
    case 'discord':
      return await hasValidTokens('discord');
    case 'email':
      return await hasValidTokens('email');
    default:
      return false;
  }
}

/**
 * Disconnect a platform
 */
export async function revokeConnection(platform: Platform): Promise<void> {
  switch (platform) {
    case 'x':
      await disconnectX();
      break;
    case 'reddit':
      // TODO: Implement Reddit disconnect
      const { removeTokens } = await import('./tokenStorageService');
      await removeTokens('reddit');
      break;
    case 'discord':
      // TODO: Implement Discord disconnect
      const { removeTokens: removeDiscordTokens } = await import('./tokenStorageService');
      await removeDiscordTokens('discord');
      break;
    case 'email':
      // TODO: Implement Email disconnect
      const { removeTokens: removeEmailTokens } = await import('./tokenStorageService');
      await removeEmailTokens('email');
      break;
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

