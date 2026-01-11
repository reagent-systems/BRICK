/**
 * Platform detection utilities
 * Centralized checks for Electron, Capacitor Native, and Web environments
 */

/**
 * Check if running in Electron
 */
export const isElectron = (): boolean => {
  return (window as any).electronAPI !== undefined;
};

/**
 * Check if running in Capacitor Native (iOS/Android)
 * Note: This returns false on web even if Capacitor packages are installed
 */
export const isNativePlatform = (): boolean => {
  const capacitor = (window as any).Capacitor;
  return capacitor?.isNativePlatform?.() === true;
};

/**
 * Check if running in a web browser (not Electron or Capacitor Native)
 */
export const isWeb = (): boolean => {
  return !isElectron() && !isNativePlatform();
};

/**
 * Get the current platform name
 */
export const getPlatformName = (): 'electron' | 'capacitor' | 'web' => {
  if (isElectron()) return 'electron';
  if (isNativePlatform()) return 'capacitor';
  return 'web';
};
