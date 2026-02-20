
import React, { useState, useEffect } from 'react';
import { Shield, Zap, Cpu, Link, Mic, Upload, Check, Layers, Server, GitBranch, Folder, RotateCcw, Eye, EyeOff as EyeOffIcon, Key, User, LogOut, LogIn, Coins } from 'lucide-react';
import { useConnections } from '../contexts/ConnectionContext';
import { useAuth } from '../contexts/AuthContext';
import { getMcpStatus, isMcpAvailable, type McpStatus } from '../services/mcpServerService';
import { getGitStatus, isGitAvailable, type GitStatus } from '../services/gitWatcherService';
import { getWatcherStatus, isWatcherAvailable, type WatcherStatus } from '../services/fileWatcherService';
import { getApiKey, setApiKey, hasApiKey } from '../services/geminiService';
import { fetchRecentTweets, isXConnected } from '../services/xOAuthService';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, signOut } from '../services/authService';
import { isFirebaseConfigured } from '../services/firebaseConfig';
import { subscribeToCredits } from '../services/creditService';
import { requireCredits } from '../services/creditGate';

// ─── Credit Section Component ────────────────────────────────────────────────

const CreditSection: React.FC<{ onOpenTopUp?: () => void }> = ({ onOpenTopUp }) => {
  const { user, isAuthenticated } = useAuth();
  const { connections } = useConnections();
  const [credits, setCredits] = useState(0);

  const hasPaidChannel = connections.x || connections.reddit || connections.discord;
  const needsCreditsForAI = !hasApiKey() && isFirebaseConfigured();

  useEffect(() => {
    if (!isFirebaseConfigured() || !isAuthenticated || !user) {
      setCredits(0);
      return;
    }
    return subscribeToCredits(user.uid, setCredits);
  }, [isAuthenticated, user]);

  // Don't show credits section if no paid channels and user has own AI key
  if (!hasPaidChannel && !needsCreditsForAI) {
    return null;
  }

  return (
    <section>
      <h3 className="text-[10px] font-bold text-df-orange uppercase mb-4 flex items-center gap-2">
        <Coins size={12} /> CREDITS
      </h3>

      <div className="space-y-3">
        {/* Balance */}
        <div className="bg-[#111] border border-df-border p-3 flex items-center justify-between">
          <span className="text-[10px] text-df-gray uppercase">Balance</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-df-white">{credits}</span>
            <span className="text-[10px] font-bold text-df-orange">CR</span>
          </div>
        </div>

        {/* What costs credits */}
        <div className="bg-[#111] border border-df-border border-dashed p-3">
          <p className="text-[9px] text-df-gray uppercase font-bold mb-2">Costs credits:</p>
          <div className="space-y-1 text-[9px]">
            <div className="flex justify-between"><span className="text-df-gray">Post to X / Reddit / Discord</span><span className="text-df-orange font-bold">1 CR</span></div>
            <div className="flex justify-between"><span className="text-df-gray">Fetch feedback (X / Reddit / Discord)</span><span className="text-df-orange font-bold">1 CR</span></div>
            <div className="flex justify-between"><span className="text-df-gray">Import X history</span><span className="text-df-orange font-bold">1 CR</span></div>
            {needsCreditsForAI && (
              <div className="flex justify-between"><span className="text-df-gray">AI drafts (no own key)</span><span className="text-df-orange font-bold">1 CR</span></div>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-df-border text-[9px]">
            <p className="text-green-500 uppercase font-bold mb-1">Free:</p>
            <span className="text-df-gray">
              {hasApiKey() ? 'AI drafts (own key) · ' : ''}Email · MCP · Git · File Watcher
            </span>
          </div>
        </div>

        {/* Top up button */}
        {(hasPaidChannel || needsCreditsForAI) && (
          <button
            onClick={onOpenTopUp}
            className="w-full py-3 border border-df-orange text-[10px] text-df-orange hover:bg-df-orange hover:text-df-black transition-colors uppercase font-bold flex items-center justify-center gap-2"
          >
            <Coins size={12} /> Top Up Credits
          </button>
        )}

        {!hasPaidChannel && !needsCreditsForAI && (
          <div className="bg-[#111] border border-df-border p-3">
            <p className="text-[9px] text-df-gray">
              Credits are needed when you connect to X, Reddit, or Discord.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

// ─── Settings Panel ──────────────────────────────────────────────────────────

interface SettingsPanelProps {
  toneContext: string;
  setToneContext: (s: string) => void;
  onNavigateToOnboarding?: () => void;
  onOpenInputChannels?: () => void;
  onOpenTopUp?: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ toneContext, setToneContext, onNavigateToOnboarding, onOpenInputChannels, onOpenTopUp }) => {
  const { connections } = useConnections();
  const [analyzed, setAnalyzed] = useState(false);
  const [protocols, setProtocols] = useState({
    watcher: true,
    commits: true,
    mcp: true
  });

  // Inbound channel status
  const [mcpStatus, setMcpStatus] = useState<McpStatus>({ running: false, port: null, ip: null, activeSessions: 0, totalEvents: 0 });
  const [gitStatus, setGitStatus] = useState<GitStatus>({ watching: false, repoPath: null, branch: null, totalCommits: 0 });
  const [watcherStatus, setWatcherStatus] = useState<WatcherStatus>({ watching: false, folders: [], totalEvents: 0 });

  // AI API key
  const [apiKeyInput, setApiKeyInput] = useState(() => getApiKey());
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);

  // Poll inbound channel status
  useEffect(() => {
    const refresh = async () => {
      if (isMcpAvailable()) getMcpStatus().then(setMcpStatus).catch(() => {});
      if (isGitAvailable()) getGitStatus().then(setGitStatus).catch(() => {});
      if (isWatcherAvailable()) getWatcherStatus().then(setWatcherStatus).catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  const [importing, setImporting] = useState(false);

  const handleImportFromX = async () => {
    setImporting(true);
    try {
      const connected = await isXConnected();
      if (!connected) {
        alert('Connect your X account first (Outbound Channels).');
        return;
      }

      // X API call costs credits
      const creditCheck = await requireCredits('x', 'Import X history');
      if (!creditCheck.allowed) {
        alert(creditCheck.error || 'Insufficient credits');
        return;
      }

      const tweets = await fetchRecentTweets(20);
      if (tweets.length === 0) {
        alert('No tweets found on your account to import.');
        return;
      }

      // Format tweets as numbered list for the tone context
      const formatted = tweets
        .map((text, i) => `${i + 1}. "${text}"`)
        .join('\n');

      setToneContext(formatted);
      setAnalyzed(false);
    } catch (error) {
      console.error('Failed to import tweets:', error);
      alert(`Failed to import: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setImporting(false);
    }
  };

  const handleAnalyze = () => {
    if (!toneContext) return;
    setAnalyzed(true);
    setTimeout(() => setAnalyzed(false), 3000);
  };

  const toggleProtocol = (key: keyof typeof protocols) => {
    setProtocols(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Clear cache with 3-step confirmation
  const [clearStep, setClearStep] = useState(0); // 0=idle, 1=first warning, 2=second warning, 3=final confirm

  const handleClearCache = () => {
    setClearStep(1);
  };

  const executeClearCache = () => {
    const keysToKeep = ['onboarding_complete', 'onboarding_step'];
    const allKeys = Object.keys(localStorage);
    for (const key of allKeys) {
      if (!keysToKeep.includes(key)) {
        localStorage.removeItem(key);
      }
    }
    sessionStorage.clear();
    setClearStep(0);
    window.location.reload();
  };

  // Auth
  const { user, isAuthenticated } = useAuth();
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleEmailAuth = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      if (authMode === 'signup') {
        await signUpWithEmail(authEmail, authPassword);
      } else {
        await signInWithEmail(authEmail, authPassword);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const inboundActive = mcpStatus.running || gitStatus.watching || watcherStatus.folders.length > 0;

  return (
    <div className="flex flex-col h-full bg-df-black">
      <div className="p-4 border-b border-df-border flex justify-between items-center">
        <h2 className="text-[10px] font-bold text-df-gray uppercase tracking-widest">SETTINGS</h2>
      </div>

      <div className="flex-grow overflow-y-auto p-4 space-y-8">

        {/* ACCOUNT SECTION */}
        <section>
          <h3 className="text-[10px] font-bold text-df-orange uppercase mb-4 flex items-center gap-2">
            <User size={12} /> ACCOUNT
          </h3>
          {!isFirebaseConfigured() ? (
            <div className="bg-[#111] border border-df-border p-3 space-y-2">
              <p className="text-[9px] text-df-gray">
                Firebase is not configured. Add your Firebase config to enable user accounts and credit sync across devices.
              </p>
              <p className="text-[8px] text-df-gray/60">
                Without an account, you can still use BRICK locally with your own API key (Settings → AI Engine).
              </p>
            </div>
          ) : isAuthenticated && user ? (
            <div className="bg-[#111] border border-df-border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-df-white font-bold">{user.displayName || 'User'}</div>
                  <div className="text-[9px] text-df-gray">{user.email}</div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1 text-[9px] text-df-gray hover:text-red-400 uppercase font-bold transition-colors"
                >
                  <LogOut size={10} /> Sign Out
                </button>
              </div>
              <div className="text-[9px] text-df-gray pt-2 border-t border-df-border">
                Credits sync across all your devices when signed in.
              </div>
            </div>
          ) : (
            <div className="bg-[#111] border border-df-border p-3 space-y-3">
              <p className="text-[9px] text-df-gray">
                Sign in to sync credits across devices and use BRICK AI without your own API key.
              </p>
              {authError && (
                <div className="text-[9px] text-red-400 bg-red-900/20 border border-red-700/30 p-2">
                  {authError}
                </div>
              )}
              <button
                onClick={handleGoogleAuth}
                disabled={authLoading}
                className="w-full py-2 bg-df-white text-black text-[10px] font-bold uppercase hover:bg-df-orange transition-colors flex items-center justify-center gap-2"
              >
                <LogIn size={12} /> Sign in with Google
              </button>
              <div className="flex items-center gap-2">
                <div className="flex-grow h-px bg-df-border" />
                <span className="text-[8px] text-df-gray uppercase">or</span>
                <div className="flex-grow h-px bg-df-border" />
              </div>
              <div className="space-y-2">
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full bg-black border border-df-border text-xs text-df-white p-2 outline-none focus:border-df-orange transition-colors font-mono"
                />
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-black border border-df-border text-xs text-df-white p-2 outline-none focus:border-df-orange transition-colors font-mono"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleEmailAuth}
                    disabled={authLoading || !authEmail || !authPassword}
                    className="flex-grow py-2 bg-df-white text-black text-[10px] font-bold uppercase hover:bg-df-orange transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {authLoading ? '...' : authMode === 'signup' ? 'SIGN UP' : 'SIGN IN'}
                  </button>
                </div>
                <button
                  onClick={() => setAuthMode(m => m === 'signin' ? 'signup' : 'signin')}
                  className="text-[9px] text-df-gray hover:text-df-orange transition-colors"
                >
                  {authMode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* CREDITS SECTION */}
        <CreditSection onOpenTopUp={onOpenTopUp} />

        {/* INBOUND CHANNELS SECTION */}
        <section>
          <button
            onClick={onOpenInputChannels}
            className="text-[10px] font-bold text-df-orange uppercase mb-4 flex items-center gap-2 hover:text-df-white transition-colors cursor-pointer group"
          >
            <Layers size={12} /> INBOUND CHANNELS
          </button>
          <div className="space-y-3">
            <div className="bg-[#111] border border-df-border p-3 space-y-3">
              {/* MCP */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server size={10} className={mcpStatus.running ? 'text-df-orange' : 'text-df-gray'} />
                  <span className="text-xs text-df-white font-bold uppercase">MCP Server</span>
                </div>
                <div className="flex items-center gap-2">
                  {mcpStatus.running && (
                    <span className="text-[8px] text-df-gray">{mcpStatus.activeSessions} session(s)</span>
                  )}
                  <span className={`text-[10px] font-bold uppercase ${mcpStatus.running ? 'text-green-500' : 'text-df-gray'}`}>
                    {mcpStatus.running ? 'RUNNING' : 'STOPPED'}
                  </span>
                  {mcpStatus.running && <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />}
                </div>
              </div>

              {/* Git */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitBranch size={10} className={gitStatus.watching ? 'text-df-orange' : 'text-df-gray'} />
                  <span className="text-xs text-df-white font-bold uppercase">Git Watcher</span>
                </div>
                <div className="flex items-center gap-2">
                  {gitStatus.watching && gitStatus.branch && (
                    <span className="text-[8px] text-df-gray">{gitStatus.repoPath?.split('/').pop()} ({gitStatus.branch})</span>
                  )}
                  <span className={`text-[10px] font-bold uppercase ${gitStatus.watching ? 'text-green-500' : 'text-df-gray'}`}>
                    {gitStatus.watching ? 'WATCHING' : 'INACTIVE'}
                  </span>
                  {gitStatus.watching && <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />}
                </div>
              </div>

              {/* File Watcher */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Folder size={10} className={watcherStatus.folders.length > 0 ? 'text-df-orange' : 'text-df-gray'} />
                  <span className="text-xs text-df-white font-bold uppercase">File Watcher</span>
                </div>
                <div className="flex items-center gap-2">
                  {watcherStatus.folders.length > 0 && (
                    <span className="text-[8px] text-df-gray">{watcherStatus.folders.length} folder(s)</span>
                  )}
                  <span className={`text-[10px] font-bold uppercase ${watcherStatus.folders.length > 0 ? 'text-green-500' : 'text-df-gray'}`}>
                    {watcherStatus.folders.length > 0 ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                  {watcherStatus.folders.length > 0 && <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />}
                </div>
              </div>
            </div>

            <button
              onClick={onOpenInputChannels}
              className="w-full py-2 border border-df-orange text-[10px] text-df-orange hover:bg-df-orange hover:text-df-black transition-colors uppercase font-bold"
            >
              Establish Inbound Link
            </button>
          </div>
        </section>

        {/* SYNC PROTOCOLS SECTION */}
        <section>
          <h3 className="text-[10px] font-bold text-df-orange uppercase mb-4 flex items-center gap-2">
            <Zap size={12} /> SYNC PROTOCOLS
          </h3>
          <div className="space-y-3">
             <div className="bg-[#111] border border-df-border p-3 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-xs text-df-white font-bold uppercase">Live File Watcher</span>
                        <span className="text-[9px] text-df-gray">Detects raw file saves and updates.</span>
                    </div>
                    <button 
                        onClick={() => toggleProtocol('watcher')}
                        className={`w-10 h-5 border flex items-center transition-colors ${protocols.watcher ? 'bg-df-orange border-df-orange justify-end' : 'bg-black border-df-border justify-start'}`}
                    >
                        <div className={`w-4 h-4 bg-black m-0.5 border ${protocols.watcher ? 'border-black' : 'border-df-border'}`}></div>
                    </button>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-xs text-df-white font-bold uppercase">Commit Detector</span>
                        <span className="text-[9px] text-df-gray">Triggers on git commits</span>
                    </div>
                    <button 
                        onClick={() => toggleProtocol('commits')}
                        className={`w-10 h-5 border flex items-center transition-colors ${protocols.commits ? 'bg-df-orange border-df-orange justify-end' : 'bg-black border-df-border justify-start'}`}
                    >
                        <div className={`w-4 h-4 bg-black m-0.5 border ${protocols.commits ? 'border-black' : 'border-df-border'}`}></div>
                    </button>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-xs text-df-white font-bold uppercase">MCP Standard</span>
                        <span className="text-[9px] text-df-gray">Hooks into AI agent reasoning flows.</span>
                    </div>
                    <button 
                        onClick={() => toggleProtocol('mcp')}
                        className={`w-10 h-5 border flex items-center transition-colors ${protocols.mcp ? 'bg-df-orange border-df-orange justify-end' : 'bg-black border-df-border justify-start'}`}
                    >
                        <div className={`w-4 h-4 bg-black m-0.5 border ${protocols.mcp ? 'border-black' : 'border-df-border'}`}></div>
                    </button>
                </div>
             </div>
          </div>
        </section>

        {/* TONE CALIBRATION SECTION */}
        <section>
          <h3 className="text-[10px] font-bold text-df-orange uppercase mb-4 flex items-center gap-2">
            <Mic size={12} /> TONE CALIBRATION
          </h3>
          <div className="space-y-4">
            <div className="bg-[#111] border border-df-border p-3">
              <p className="text-[10px] text-df-gray mb-3">
                Paste previous posts to train the AI on your specific writing style.
              </p>
              <textarea 
                value={toneContext}
                onChange={(e) => setToneContext(e.target.value)}
                placeholder="e.g. 'Shipped v2.0 today. The latency drop is insane.'"
                className="w-full bg-black border border-df-border text-xs text-df-white p-3 min-h-[100px] outline-none focus:border-df-orange transition-colors font-mono resize-y"
              />
              <div className="flex justify-between items-center mt-3">
                 <button 
                   onClick={handleImportFromX}
                   disabled={importing}
                   className={`flex items-center gap-2 text-[9px] uppercase font-bold transition-colors ${
                     importing ? 'text-df-orange cursor-wait' : 'text-df-gray hover:text-df-white'
                   }`}
                 >
                    <Upload size={10} className={importing ? 'animate-pulse' : ''} /> 
                    {importing ? 'Importing...' : 'Import from X History'}
                 </button>
                 <button 
                    onClick={handleAnalyze}
                    className={`px-4 py-2 text-[10px] font-bold uppercase transition-all ${analyzed ? 'bg-green-900 text-green-400' : 'bg-df-white text-black hover:bg-df-orange'}`}
                 >
                    {analyzed ? <span className="flex items-center gap-1"><Check size={10} /> CALIBRATED</span> : 'CALIBRATE'}
                 </button>
              </div>
            </div>
          </div>
        </section>

        {/* OUTBOUND CHANNELS SECTION */}
        <section>
          <button
            onClick={onNavigateToOnboarding}
            className="text-[10px] font-bold text-df-orange uppercase mb-4 flex items-center gap-2 hover:text-df-white transition-colors cursor-pointer group"
          >
            <Link size={12} /> OUTBOUND CHANNELS
          </button>
          <div className="space-y-3">
            <div className="bg-[#111] border border-df-border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-df-white font-bold uppercase">X</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase ${connections.x ? 'text-green-500' : 'text-df-gray'}`}>
                    {connections.x ? 'CONNECTED' : 'NOT CONNECTED'}
                  </span>
                  {connections.x && <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-df-white font-bold uppercase">Reddit</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase ${connections.reddit ? 'text-green-500' : 'text-df-gray'}`}>
                    {connections.reddit ? 'CONNECTED' : 'NOT CONNECTED'}
                  </span>
                  {connections.reddit && <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-df-white font-bold uppercase">Discord</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase ${connections.discord ? 'text-green-500' : 'text-df-gray'}`}>
                    {connections.discord ? 'CONNECTED' : 'NOT CONNECTED'}
                  </span>
                  {connections.discord && <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-df-white font-bold uppercase">Email</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase ${connections.email ? 'text-green-500' : 'text-df-gray'}`}>
                    {connections.email ? 'CONNECTED' : 'NOT CONNECTED'}
                  </span>
                  {connections.email && <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />}
                </div>
              </div>
            </div>
            <button
              onClick={onNavigateToOnboarding}
              className="w-full py-2 border border-df-orange text-[10px] text-df-orange hover:bg-df-orange hover:text-df-black transition-colors uppercase font-bold"
            >
              Establish Outbound Link
            </button>
          </div>
        </section>

        {/* AI ENGINE SECTION */}
        <section>
          <h3 className="text-[10px] font-bold text-df-orange uppercase mb-4 flex items-center gap-2">
            <Cpu size={12} /> AI ENGINE
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-df-gray">Current Model</span>
              <span className="text-xs text-df-white font-mono">gemini-2.5-flash</span>
            </div>

            {/* API Key Input */}
            <div className="bg-[#111] border border-df-border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-df-gray uppercase flex items-center gap-1">
                  <Key size={10} /> Gemini API Key
                </label>
                <span className={`text-[9px] font-bold uppercase ${hasApiKey() ? 'text-green-500' : 'text-red-400'}`}>
                  {hasApiKey() ? 'CONFIGURED' : 'NOT SET'}
                </span>
              </div>
              <div className="flex gap-2">
                <div className="flex-grow relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => {
                      setApiKeyInput(e.target.value);
                      setApiKeySaved(false);
                    }}
                    placeholder="AIza..."
                    className="w-full bg-black border border-df-border text-xs text-df-white p-2 pr-8 outline-none focus:border-df-orange transition-colors font-mono"
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-df-gray hover:text-df-white"
                  >
                    {showApiKey ? <EyeOffIcon size={12} /> : <Eye size={12} />}
                  </button>
                </div>
                <button
                  onClick={() => {
                    setApiKey(apiKeyInput);
                    setApiKeySaved(true);
                    setTimeout(() => setApiKeySaved(false), 2000);
                  }}
                  className={`px-3 py-2 text-[10px] font-bold uppercase transition-colors shrink-0 ${
                    apiKeySaved 
                      ? 'bg-green-900 text-green-400' 
                      : 'bg-df-white text-black hover:bg-df-orange'
                  }`}
                >
                  {apiKeySaved ? <Check size={12} /> : 'SAVE'}
                </button>
              </div>
              <p className="text-[8px] text-df-gray">
                Get your key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-df-orange hover:text-df-white underline">aistudio.google.com</a>. Stored locally on this device only.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" defaultChecked className="accent-df-orange" />
              <span className="text-[10px] text-df-gray uppercase">Enable Search Grounding</span>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" defaultChecked className="accent-df-orange" />
              <span className="text-[10px] text-df-gray uppercase">Enable Diff Sampling</span>
            </div>
          </div>
        </section>

        {/* PRIVACY SECTION */}
        <section>
          <h3 className="text-[10px] font-bold text-df-orange uppercase mb-4 flex items-center gap-2">
            <Shield size={12} /> PRIVACY
          </h3>
          <div className="space-y-4">
            <div className="p-3 bg-[#111] border border-df-border border-dashed">
              <p className="text-[10px] text-df-gray mb-2">Sensitive filenames or patterns to ignore (e.g. .env, *.pem)</p>
              <div className="flex gap-2">
                <span className="text-[9px] bg-black border border-df-border px-1 text-df-white">.env</span>
                <span className="text-[9px] bg-black border border-df-border px-1 text-df-white">secrets/*</span>
              </div>
            </div>
            <button 
              onClick={handleClearCache}
              className="w-full py-2 border border-df-border text-[10px] text-df-gray hover:text-red-400 hover:border-red-400 transition-colors uppercase font-bold"
            >
              Clear Local Cache
            </button>
            <button 
              onClick={onNavigateToOnboarding}
              className="w-full py-2 border border-df-border text-[10px] text-df-gray hover:text-df-orange hover:border-df-orange transition-colors uppercase font-bold flex items-center justify-center gap-2"
            >
              <RotateCcw size={10} /> Re-run Onboarding
            </button>
          </div>
        </section>

        {/* FOOTER */}
        <div className="pt-8 text-center">
            <p className="text-[9px] text-df-gray/30 uppercase tracking-[0.2em]">BRICK v1.0.4-alpha</p>
        </div>
      </div>

      {/* Clear Cache Warning Modal (3 steps) */}
      {clearStep > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 font-mono">
          <div className="bg-df-black border border-df-border w-full max-w-sm mx-4 shadow-2xl">

            {/* Step indicator */}
            <div className="h-1 bg-df-border">
              <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${(clearStep / 3) * 100}%` }} />
            </div>

            <div className="p-6">
              {clearStep === 1 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <h3 className="text-sm font-black text-df-white uppercase">Are you sure?</h3>
                  <p className="text-xs text-df-gray leading-relaxed">
                    This will clear all locally stored data including OAuth tokens, API keys, tone calibration, and session history.
                  </p>
                  <p className="text-[10px] text-red-400 font-bold uppercase">
                    You will be disconnected from all platforms.
                  </p>
                </div>
              )}

              {clearStep === 2 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <h3 className="text-sm font-black text-red-400 uppercase">This cannot be undone</h3>
                  <p className="text-xs text-df-gray leading-relaxed">
                    Your OAuth connections (X, Reddit, Discord, Email) will need to be re-established. Your Gemini API key will be removed.
                  </p>
                  <p className="text-[10px] text-df-gray">
                    Cloud-synced credits (if signed in) are safe and won't be affected.
                  </p>
                </div>
              )}

              {clearStep === 3 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <h3 className="text-sm font-black text-red-500 uppercase">Final confirmation</h3>
                  <div className="bg-red-900/20 border border-red-700/50 p-3">
                    <p className="text-xs text-red-400">
                      Click "CLEAR EVERYTHING" to permanently erase all local data. The app will reload.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Step 1: Continue on RIGHT */}
            {clearStep === 1 && (
              <div className="flex border-t border-df-border">
                <button
                  onClick={() => setClearStep(0)}
                  className="w-1/2 py-4 text-df-gray hover:text-white text-[10px] font-bold uppercase border-r border-df-border"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setClearStep(2)}
                  className="w-1/2 py-4 text-red-400 hover:text-red-300 text-[10px] font-bold uppercase"
                >
                  Continue (1/3)
                </button>
              </div>
            )}

            {/* Step 2: Continue on LEFT, Cancel on RIGHT */}
            {clearStep === 2 && (
              <div className="flex border-t border-df-border">
                <button
                  onClick={() => setClearStep(3)}
                  className="w-1/2 py-4 text-red-400 hover:text-red-300 text-[10px] font-bold uppercase border-r border-df-border"
                >
                  Continue (2/3)
                </button>
                <button
                  onClick={() => setClearStep(0)}
                  className="w-1/2 py-4 text-df-gray hover:text-white text-[10px] font-bold uppercase"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Step 3: Full-width clear button (different from both previous positions) */}
            {clearStep === 3 && (
              <div className="border-t border-df-border">
                <button
                  onClick={() => setClearStep(0)}
                  className="w-full py-3 text-df-gray hover:text-white text-[10px] font-bold uppercase border-b border-df-border"
                >
                  Cancel
                </button>
                <button
                  onClick={executeClearCache}
                  className="w-full py-4 bg-red-900 text-red-400 hover:bg-red-800 text-[10px] font-bold uppercase"
                >
                  Clear Everything
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPanel;
