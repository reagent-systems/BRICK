import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getConnectionStatus } from '../services/oauthService';

interface ConnectionStatus {
  x: boolean;
  reddit: boolean;
  discord: boolean;
  email: boolean;
}

interface ConnectionContextType {
  connections: ConnectionStatus;
  refreshConnections: () => Promise<void>;
  isConnected: (platform: 'x' | 'reddit' | 'discord' | 'email') => boolean;
  hasAnyConnection: () => boolean;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export const useConnections = () => {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error('useConnections must be used within ConnectionProvider');
  }
  return context;
};

export const ConnectionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [connections, setConnections] = useState<ConnectionStatus>({
    x: false,
    reddit: false,
    discord: false,
    email: false,
  });

  const refreshConnections = async () => {
    try {
      const [x, reddit, discord, email] = await Promise.all([
        getConnectionStatus('x'),
        getConnectionStatus('reddit'),
        getConnectionStatus('discord'),
        getConnectionStatus('email'),
      ]);

      setConnections({ x, reddit, discord, email });
    } catch (error) {
      console.error('Failed to refresh connections:', error);
    }
  };

  // Check connections on mount
  useEffect(() => {
    refreshConnections();
  }, []);

  // Listen for OAuth completion events
  useEffect(() => {
    const handleOAuthComplete = () => {
      refreshConnections();
    };

    window.addEventListener('oauth-complete', handleOAuthComplete);
    return () => window.removeEventListener('oauth-complete', handleOAuthComplete);
  }, []);

  const isConnected = (platform: 'x' | 'reddit' | 'discord' | 'email') => {
    return connections[platform];
  };

  const hasAnyConnection = () => {
    return connections.x || connections.reddit || connections.discord || connections.email;
  };

  return (
    <ConnectionContext.Provider
      value={{
        connections,
        refreshConnections,
        isConnected,
        hasAnyConnection,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
};

