
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Activity, Settings, ShieldCheck, Square } from 'lucide-react';
import DraftsPanel from './components/DraftsPanel';
import FeedbackPanel from './components/FeedbackPanel';
import SettingsPanel from './components/SettingsPanel';
import Onboarding from './components/Onboarding';
import InputChannelsSetup from './components/InputChannelsSetupModal';
import { Platform, InputEvent } from './types';
import { handleOAuthCallback } from './services/oauthService';
import { ConnectionProvider } from './contexts/ConnectionContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { isElectron, isNativePlatform } from './utils/platform';
import { onMcpProgress, isMcpAvailable } from './services/mcpServerService';
import { onGitCommit, isGitAvailable, getGitCommitLog } from './services/gitWatcherService';
import { onFileChange, isWatcherAvailable } from './services/fileWatcherService';
import { subscribeToCredits } from './services/creditService';
import { isFirebaseConfigured } from './services/firebaseConfig';

const CreditTopUpModal = lazy(() => import('./components/CreditTopUpModal'));

export type ActivityTab = 'devflow' | 'settings';

const App: React.FC = () => {
  // Check if onboarding was completed previously
  const [view, setView] = useState<'onboarding' | 'setup' | 'main'>(() => {
    const onboardingComplete = localStorage.getItem('onboarding_complete') === 'true';
    return onboardingComplete ? 'main' : 'onboarding';
  });
  const [activeActivity, setActiveActivity] = useState<ActivityTab>('devflow');
  const [activeTab, setActiveTab] = useState<'drafts' | 'feedback'>('drafts');
  const [activePlatform, setActivePlatform] = useState<Platform>(Platform.X);
  // Input channel events → triggers draft generation in DraftsPanel
  const [triggerEvent, setTriggerEvent] = useState<InputEvent | null>(null);
  const [isIdeConnected, setIsIdeConnected] = useState(() => {
    return localStorage.getItem('ide_connected') === 'true';
  });
  
  // State for AI Voice Calibration
  const [toneContext, setToneContext] = useState<string>('');
  
  // Credits: real-time from Firestore when authenticated, 0 otherwise
  const { user, isAuthenticated } = useAuth();
  const [credits, setCredits] = useState(0);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpReason, setTopUpReason] = useState<string | undefined>();

  // Only subscribe to credits when Firebase is configured AND user is signed in
  useEffect(() => {
    if (!isFirebaseConfigured() || !isAuthenticated || !user) {
      setCredits(0);
      return;
    }
    return subscribeToCredits(user.uid, (c) => setCredits(c));
  }, [isAuthenticated, user]);

  // ── Input Channel Listeners ──────────────────────────────────────────────
  // Helper: when any input event arrives, also mark IDE as connected
  const handleInputEvent = (event: InputEvent) => {
    setTriggerEvent(event);
    if (!isIdeConnected) {
      setIsIdeConnected(true);
      localStorage.setItem('ide_connected', 'true');
    }
  };

  // MCP: coding agent sends log_progress
  useEffect(() => {
    if (!isMcpAvailable()) return;
    return onMcpProgress((event) => {
      handleInputEvent({
        source: 'mcp',
        context: event.summary,
        timestamp: Date.now(),
      });
    });
  }, []);

  // Git: new commit detected — also replay the latest missed commit on mount
  useEffect(() => {
    if (!isGitAvailable()) return;

    // Replay: check if commits were detected before this listener was ready
    getGitCommitLog().then((log) => {
      if (log.length > 0) {
        const latest = log[log.length - 1];
        handleInputEvent({
          source: 'git',
          context: `Commit on ${latest.branch}: ${latest.commit.message}`,
          codeSnippet: latest.diff,
          timestamp: Date.now(),
        });
      }
    }).catch(() => {});

    // Listen for future commits
    return onGitCommit((event) => {
      handleInputEvent({
        source: 'git',
        context: `Commit on ${event.branch}: ${event.commit.message}`,
        codeSnippet: event.diff,
        timestamp: Date.now(),
      });
    });
  }, []);

  // File watcher: code files changed
  useEffect(() => {
    if (!isWatcherAvailable()) return;
    return onFileChange((event) => {
      const fileList = event.files
        .filter((f: any) => !f.sensitive)
        .slice(0, 10)
        .map((f: any) => f.path)
        .join('\n');
      handleInputEvent({
        source: 'watcher',
        context: event.summary,
        codeSnippet: fileList || undefined,
        timestamp: Date.now(),
      });
    });
  }, []);

  // Auto-open top-up modal when a credit gate rejects an action
  // Only listen when paid channels are actually connected
  useEffect(() => {
    const hasPaidChannel =
      !!localStorage.getItem('oauth_tokens_x') ||
      !!localStorage.getItem('oauth_tokens_reddit') ||
      !!localStorage.getItem('oauth_tokens_discord');
    if (!hasPaidChannel) return;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setTopUpReason(detail?.reason || 'You need credits to complete this action.');
      setShowTopUp(true);
    };
    window.addEventListener('brick:credits-needed', handler);
    return () => window.removeEventListener('brick:credits-needed', handler);
  }, []);

  // Handle OAuth callbacks
  useEffect(() => {
    // Prevent double-processing in React StrictMode
    const PROCESSING_KEY = 'oauth_callback_processing';

    const handleOAuthRedirect = async () => {
      if (isElectron()) {
        // For Electron, listen to protocol handler callbacks
        const electronAPI = (window as any).electronAPI;
        electronAPI.onOAuthCallback(async (url: string) => {
          await processOAuthCallback(url);
        });
        return () => {
          electronAPI.removeOAuthCallback();
        };
      } else if (isNativePlatform()) {
        // For Capacitor Native (iOS/Android), listen to app URL events
        const { App } = await import('@capacitor/app');
        const listener = await App.addListener('appUrlOpen', async (data: { url: string }) => {
          await processOAuthCallback(data.url);
        });
        return () => {
          listener.remove();
        };
      } else {
        // For web, check current URL
        const url = window.location.href;
        if (url.includes('/auth/') && url.includes('callback')) {
          // Prevent double-processing (React StrictMode calls effects twice)
          if (sessionStorage.getItem(PROCESSING_KEY)) {
            return;
          }
          sessionStorage.setItem(PROCESSING_KEY, 'true');

          // Check if the OAuth state exists locally.
          // If not, this callback was initiated by the Electron app (which
          // opened the system browser via shell.openExternal). The state is
          // in Electron's localStorage, not the browser's. Redirect to the
          // brick:// protocol so the Electron app can handle it.
          try {
            const urlObj = new URL(url);
            const code = urlObj.searchParams.get('code');
            const state = urlObj.searchParams.get('state');

            
            if (code && state) {
              const stateKey = `oauth_state_${state}`;
              const hasLocalState = localStorage.getItem(stateKey);

              if (!hasLocalState) {
                // State not found locally — hand off to Electron via brick:// protocol
                // Determine the platform from the URL path
                let platformPath = 'twitter';
                if (url.includes('/auth/reddit/')) platformPath = 'reddit';
                else if (url.includes('/auth/discord/')) platformPath = 'discord';
                else if (url.includes('/auth/email/')) platformPath = 'email';

                const brickUrl = `brick://auth/${platformPath}/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
                
                // Show brief feedback before redirect
                document.title = 'BRICK — Redirecting to app...';
                window.location.href = brickUrl;

                // Clean up after a short delay (in case the redirect works)
                setTimeout(() => {
                  sessionStorage.removeItem(PROCESSING_KEY);
                }, 2000);
                return;
              }
            }
          } catch {
            // If URL parsing fails, fall through to normal processing
          }

          // Clean up URL immediately to prevent reprocessing on refresh
          window.history.replaceState({}, document.title, '/');

          try {
            await processOAuthCallback(url);
          } finally {
            sessionStorage.removeItem(PROCESSING_KEY);
          }
        }
      }
    };

    handleOAuthRedirect();
  }, []);

  // Track processed auth codes so we never exchange the same code twice
  const processedCodes = React.useRef<Set<string>>(new Set());

  const processOAuthCallback = async (url: string) => {
    try {
      // Handle protocol URLs (brick://, com.brick.app://) and HTTP URLs
      // Extract query parameters manually for protocol URLs
      let code: string | null = null;
      let state: string | null = null;
      let error: string | null = null;
      
      if (url.startsWith('brick://') || url.startsWith('com.brick.app://')) {
        // Protocol URL - parse manually
        const urlParts = url.split('?');
        if (urlParts.length > 1) {
          const params = new URLSearchParams(urlParts[1]);
          code = params.get('code');
          state = params.get('state');
          error = params.get('error');
        }
      } else {
        // HTTP URL - use URL constructor
        const urlObj = new URL(url);
        code = urlObj.searchParams.get('code');
        state = urlObj.searchParams.get('state');
        error = urlObj.searchParams.get('error');
      }

      if (error) {
        console.error('OAuth error:', error);
        alert(`OAuth error: ${error}`);
        return;
      }

      if (!code || !state) {
        return; // Not an OAuth callback
      }

      // Deduplicate: never process the same authorization code twice.
      // Auth codes are single-use; a second exchange attempt always fails.
      if (processedCodes.current.has(code)) {
        console.log('[OAuth] Ignoring duplicate callback for code:', code.slice(0, 8) + '...');
        return;
      }
      processedCodes.current.add(code);

      // Determine platform from URL path
      // Handle both HTTP URLs (web) and protocol URLs (Electron/Capacitor)
      let platform: 'x' | 'reddit' | 'discord' | 'email' = 'x';
      if (url.includes('/auth/twitter/') || url.includes('/auth/x/') || url.includes('twitter/callback')) {
        platform = 'x';
      } else if (url.includes('/auth/reddit/') || url.includes('reddit/callback')) {
        platform = 'reddit';
      } else if (url.includes('/auth/discord/') || url.includes('discord/callback')) {
        platform = 'discord';
      } else if (url.includes('/auth/email/') || url.includes('email/callback')) {
        platform = 'email';
      }

      // Handle the callback
      await handleOAuthCallback(platform, code, state);

      // Verify token was stored by checking immediately
      const { getConnectionStatus } = await import('./services/oauthService');
      let isNowConnected = await getConnectionStatus(platform);

      // If not connected, wait a bit and retry (token storage might be async)
      if (!isNowConnected) {
        await new Promise(resolve => setTimeout(resolve, 300));
        isNowConnected = await getConnectionStatus(platform);
      }

      // Show success/failure message
      if (!isNowConnected) {
        alert(`Warning: ${platform.toUpperCase()} token may not have been saved. Check Settings to verify.`);
      }

      // Close browser if in Capacitor NATIVE (Electron handles this automatically)
      if (isNativePlatform()) {
        try {
          const { Browser } = await import('@capacitor/browser');
          await Browser.close();
        } catch (error) {
          console.warn('Failed to close browser:', error);
        }
      }

      // Dispatch event to update global connection state
      window.dispatchEvent(new CustomEvent('oauth-complete', {
        detail: { platform, connected: isNowConnected }
      }));
    } catch (error) {
      console.error('Failed to process OAuth callback:', error);
      alert(`Failed to complete OAuth: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleNavigateToOnboarding = () => {
    localStorage.setItem('onboarding_step', '5');
    // Set a flag to indicate this is manual navigation (don't auto-complete)
    localStorage.setItem('manual_onboarding_navigation', 'true');
    setView('onboarding');
  };

  const renderContent = () => {
    // Settings panel — only mounted when active
    if (activeActivity === 'settings') {
      return (
        <SettingsPanel 
          toneContext={toneContext} 
          setToneContext={setToneContext}
          onNavigateToOnboarding={handleNavigateToOnboarding}
          onOpenInputChannels={() => setView('setup')}
          onOpenTopUp={() => { setTopUpReason(undefined); setShowTopUp(true); }}
        />
      );
    }

    // Devflow — disconnected state
    if (!isIdeConnected) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-df-black animate-in fade-in duration-300">
          <h2 className="text-df-white font-bold text-sm mb-2 uppercase tracking-tighter">DISCONNECTED</h2>
          <p className="text-df-gray text-[10px] leading-relaxed mb-8 max-w-xs mx-auto">
            BRICK needs to be initialized.
          </p>
          <button 
            onClick={() => { setView('setup'); }}
            className="w-full max-w-xs py-3 bg-df-orange text-df-black font-bold text-xs hover:bg-white transition-colors uppercase border border-df-orange"
          >
            Establish Link
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <AuthProvider>
    <ConnectionProvider>
      {view === 'onboarding' ? (
        <div className="h-screen w-screen bg-black font-mono overflow-hidden">
          <Onboarding onComplete={() => {
            localStorage.setItem('onboarding_complete', 'true');
            setView('main');
          }} />
        </div>
      ) : view === 'setup' ? (
        <InputChannelsSetup
          onClose={() => setView('main')}
          onComplete={() => {
            setIsIdeConnected(true);
            localStorage.setItem('ide_connected', 'true');
            setView('main');
          }}
        />
      ) : (
        <div className="h-screen w-screen flex bg-[#1e1e1e] text-gray-400 font-mono overflow-hidden selection:bg-df-orange/30">
      {/* 1. Activity Bar (Far Left) - Keep w-12 */}
      <div className="w-12 bg-[#181818] flex flex-col items-center py-4 shrink-0 border-r border-[#000]">
        
        {/* BRICK Tab */}
        <button 
          title="BRICK"
          onClick={() => setActiveActivity('devflow')}
          className={`relative p-1 transition-transform active:scale-95 group mt-2 mb-4`}
        >
          <div className={`w-8 h-8 flex items-center justify-center text-black font-bold text-lg transition-all ${activeActivity === 'devflow' ? 'bg-df-orange' : 'bg-[#333] hover:bg-[#444]'}`}>
            <Square size={20} strokeWidth={4} fill={activeActivity === 'devflow' ? 'black' : 'none'} className={activeActivity === 'devflow' ? 'text-black' : 'text-df-gray group-hover:text-white'} />
          </div>
        </button>

        {/* Vertical Credit Meter - click opens top-up modal or settings */}
        <div 
          onClick={() => {
            setTopUpReason(undefined);
            setShowTopUp(true);
          }}
          title={`${credits} CR — click to top up`}
          className="flex-grow w-full flex flex-col items-center justify-center py-4 px-2 group cursor-pointer"
        >
          <div className="w-8 h-full bg-black border border-df-border relative overflow-hidden flex flex-col justify-end shadow-inner group-hover:border-df-orange transition-colors">
            <div 
              className="bg-df-orange w-full transition-all duration-1000 ease-in-out" 
              style={{ height: `${Math.min((credits / 200) * 100, 100)}%` }}
            ></div>
            {/* Meter Grid Overlay: 16 lines = 15 gaps/squares */}
            <div className="absolute inset-0 flex flex-col justify-between py-0 opacity-25 pointer-events-none">
              {[...Array(16)].map((_, i) => (
                <div key={i} className="h-[1px] w-full bg-[#444]" />
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center leading-none mt-4 shrink-0">
            <span className="text-base font-black text-df-white tracking-tighter">{credits}</span>
            <span className="text-[10px] font-black text-df-orange uppercase tracking-widest mt-0.5">CR</span>
          </div>
        </div>
        
        <div className="mt-4 mb-2 flex flex-col gap-6 items-center shrink-0">
          <button 
            title="Settings"
            onClick={() => setActiveActivity('settings')}
            className={`p-1 transition-all hover:scale-110 ${activeActivity === 'settings' ? 'text-df-orange border-l-2 border-df-orange pl-2' : 'text-gray-600 hover:text-gray-300'}`}
          >
            <Settings size={24} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* 2. Main Content Area */}
      <div className="flex-grow flex flex-col bg-[#111] relative overflow-hidden items-center justify-center">
         {/* Background Decoration */}
         <div className="absolute inset-0 bg-black/5 flex items-center justify-center pointer-events-none">
            <div className="text-[20vw] font-black text-white/[0.02] select-none -rotate-6 tracking-tighter">BRICK</div>
         </div>
         
         {/* Central Panel Container */}
         <div className="w-full max-w-2xl lg:max-w-7xl h-full flex flex-col bg-df-black border-x border-[#333] shadow-2xl relative z-10 transition-all duration-300">
            {renderContent()}

            {/* DraftsPanel + FeedbackPanel: always mounted when connected, hidden when on settings */}
            {isIdeConnected && (
              <div className={`flex flex-col h-full ${activeActivity !== 'devflow' ? 'hidden' : ''}`}>
                {/* Mobile/Tablet Tabs */}
                <div className={`flex border-b border-df-border bg-df-black shrink-0 lg:hidden pt-[env(safe-area-inset-top,44px)] lg:pt-0 min-h-[48px]`}>
                  <button 
                    onClick={() => setActiveTab('drafts')}
                    className={`flex-1 text-xs font-bold tracking-wider hover:bg-[#111] transition-colors flex items-center justify-center ${activeTab === 'drafts' ? 'text-df-white border-b-4 border-df-orange py-2' : 'text-df-gray py-2 border-b-4 border-transparent'}`}
                  >
                    DRAFTS
                  </button>
                  <button 
                    onClick={() => setActiveTab('feedback')}
                    className={`flex-1 text-xs font-bold tracking-wider hover:bg-[#111] transition-colors flex items-center justify-center ${activeTab === 'feedback' ? 'text-df-white border-b-4 border-df-orange py-2' : 'text-df-gray py-2 border-b-4 border-transparent'}`}
                  >
                    FEEDBACK
                  </button>
                </div>

                <div className="flex-grow overflow-hidden relative flex flex-col lg:flex-row">
                  <div className={`flex-grow h-full lg:w-1/2 lg:border-r border-df-border ${activeTab === 'drafts' ? 'block' : 'hidden lg:block'}`}>
                    <div className="hidden lg:flex h-10 border-b border-df-border items-center px-4 bg-df-black shrink-0">
                      <span className="text-xs font-bold text-df-white tracking-wider">DRAFTS</span>
                    </div>
                    <div className="h-full lg:h-[calc(100%-40px)]">
                      <DraftsPanel 
                        activePlatform={activePlatform} 
                        setActivePlatform={setActivePlatform} 
                        triggerEvent={triggerEvent}
                        toneContext={toneContext}
                      />
                    </div>
                  </div>

                  <div className={`flex-grow h-full lg:w-1/2 ${activeTab === 'feedback' ? 'block' : 'hidden lg:block'}`}>
                    <div className="hidden lg:flex h-10 border-b border-df-border items-center px-4 bg-df-black shrink-0">
                      <span className="text-xs font-bold text-df-white tracking-wider">FEEDBACK</span>
                    </div>
                    <div className="h-full lg:h-[calc(100%-40px)]">
                      <FeedbackPanel />
                    </div>
                  </div>
                </div>
              </div>
            )}
         </div>
      </div>
    </div>
      )}
      {showTopUp && (
        <Suspense fallback={null}>
          <CreditTopUpModal
            isOpen={showTopUp}
            onClose={() => setShowTopUp(false)}
            reason={topUpReason}
          />
        </Suspense>
      )}
    </ConnectionProvider>
    </AuthProvider>
  );
};

export default App;
