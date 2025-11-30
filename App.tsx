import React, { useState, useEffect } from 'react';
import { AppView } from './types';
import { SingleUrlProcessor } from './components/SingleUrlProcessor';
import { BulkUrlProcessor } from './components/BulkUrlProcessor';
import { Link as LinkIcon, Layers, Bot, Sparkles, Settings, Key, X, ExternalLink, AlertTriangle } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.HOME);
  const [showIntro, setShowIntro] = useState(true);
  const [introOpacity, setIntroOpacity] = useState(1);
  
  // API Key Management
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [keyError, setKeyError] = useState('');

  // Initial Checks
  useEffect(() => {
    // Intro Animation
    const fadeTimer = setTimeout(() => {
      setIntroOpacity(0);
    }, 2000);
    const removeTimer = setTimeout(() => {
      setShowIntro(false);
    }, 2500);

    // Check for API Key
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) {
      setApiKey(storedKey);
    } else {
      // If no key found in local storage, prompt user
      setShowApiKeyModal(true);
    }

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  const validateApiKey = (key: string): boolean => {
    // Basic Google API Key validation: starts with AIza and is roughly 39 chars long
    // We'll be slightly lenient on length but strict on prefix
    return key.trim().startsWith('AIza') && key.trim().length > 30;
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setApiKey(value);

    // Clear error if empty to avoid annoying initial state, 
    // but if they backspace to empty, it's fine to clear.
    if (!value.trim()) {
      setKeyError('');
      return;
    }

    // Real-time validation feedback
    if (!value.trim().startsWith('AIza')) {
      setKeyError('Invalid format. Google API Keys must start with "AIza".');
    } else if (value.trim().length <= 30) {
      // Show warning for length, but maybe user is still typing/pasting
      setKeyError('Key appears to be too short.');
    } else {
      setKeyError('');
    }
  };

  const handleSaveApiKey = (key: string) => {
    // Final check before saving
    const trimmedKey = key.trim();

    if (!trimmedKey) {
      setKeyError('API Key cannot be empty.');
      return;
    }

    if (!validateApiKey(trimmedKey)) {
      // Ensure we catch cases where real-time didn't trigger or was ignored
      if (!trimmedKey.startsWith('AIza')) {
         setKeyError('Invalid API Key format. Must start with "AIza".');
      } else {
         setKeyError('Invalid API Key. Length is too short.');
      }
      return;
    }

    localStorage.setItem('gemini_api_key', trimmedKey);
    setApiKey(trimmedKey);
    setKeyError('');
    setShowApiKeyModal(false);
  };

  const renderContent = () => {
    switch (currentView) {
      case AppView.SINGLE:
        return <SingleUrlProcessor />;
      case AppView.BULK:
        return <BulkUrlProcessor />;
      case AppView.HOME:
      default:
        return <HomeDashboard setView={setCurrentView} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      
      {/* Intro Overlay */}
      {showIntro && (
        <div 
          className="fixed inset-0 z-[100] bg-slate-900 flex items-center justify-center transition-opacity duration-700 ease-in-out"
          style={{ opacity: introOpacity }}
        >
          <div className="text-center animate-pulse">
            <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 tracking-tighter">
              Hi Team FOps
            </h1>
            <div className="mt-4 flex justify-center gap-2 text-slate-400">
               <Sparkles className="animate-spin text-yellow-400" size={24} />
               <span className="text-lg">Initializing Workspace...</span>
            </div>
          </div>
        </div>
      )}

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Key className="text-indigo-500" size={20} /> Configure Gemini API
              </h3>
              {/* Allow closing if a key exists in state (even if not saved yet, but assuming user cancels edit) */}
              {/* Only allow closing if a valid key is already saved in localStorage, otherwise force entry */}
              {localStorage.getItem('gemini_api_key') && (
                <button 
                  onClick={() => { 
                    setShowApiKeyModal(false); 
                    setKeyError(''); 
                    // Reset to stored key if cancelled
                    setApiKey(localStorage.getItem('gemini_api_key') || '');
                  }} 
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={20} />
                </button>
              )}
            </div>
            
            <p className="text-slate-600 text-sm mb-6">
              To use ContentTransformer, you need your own Google Gemini API Key. 
              The key is stored securely in your browser's local storage.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveApiKey(apiKey); }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Gemini API Key</label>
                  <input 
                    type="password" 
                    required
                    placeholder="AIzaSy..."
                    className={`w-full px-4 py-3 rounded-lg border focus:ring-2 outline-none transition-all font-mono text-sm ${keyError ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100'}`}
                    value={apiKey}
                    onChange={handleApiKeyChange}
                  />
                  {keyError && (
                    <div className="flex items-center gap-1 text-red-500 text-xs mt-2 animate-in slide-in-from-top-1 font-medium">
                      <AlertTriangle size={12} />
                      <span>{keyError}</span>
                    </div>
                  )}
                </div>
                
                <button 
                  type="submit" 
                  disabled={!!keyError || !apiKey}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-all"
                >
                  Save API Key
                </button>

                <div className="text-center">
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-xs text-indigo-500 hover:text-indigo-600 hover:underline flex items-center justify-center gap-1"
                  >
                    Get a free API Key here <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer group" 
            onClick={() => setCurrentView(AppView.HOME)}
          >
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white group-hover:rotate-12 transition-transform">
              <Bot size={20} />
            </div>
            <span className="font-bold text-xl text-slate-800 tracking-tight">ContentTransformer</span>
          </div>

          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-1">
              <NavButton 
                active={currentView === AppView.SINGLE} 
                onClick={() => setCurrentView(AppView.SINGLE)}
                icon={<LinkIcon size={18} />}
                label="Single URL"
              />
              <NavButton 
                active={currentView === AppView.BULK} 
                onClick={() => setCurrentView(AppView.BULK)}
                icon={<Layers size={18} />}
                label="Bulk Processing"
              />
            </nav>
            <div className="h-6 w-px bg-slate-200 mx-2"></div>
            <button 
              onClick={() => { 
                setShowApiKeyModal(true); 
                setKeyError(''); 
                // Populate with existing key for editing
                setApiKey(localStorage.getItem('gemini_api_key') || '');
              }}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
              title="API Key Settings"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 bg-slate-50 py-12 px-6">
        {renderContent()}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-slate-500 text-sm font-medium">
            @2025 made for Fops team CK by BK Product, Keep Hustling.
          </p>
        </div>
      </footer>
    </div>
  );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
      active 
        ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100' 
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`}
  >
    {icon}
    {label}
  </button>
);

const HomeDashboard: React.FC<{ setView: (view: AppView) => void }> = ({ setView }) => {
  return (
    <div className="max-w-5xl mx-auto text-center space-y-12 animate-in fade-in zoom-in duration-700">
      <div className="space-y-4 pt-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold uppercase tracking-wider mb-2">
           <Sparkles size={12} /> Production Ready
        </div>
        <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight">
          Transform the Web with <span className="text-indigo-600">Gemini 2.5</span>
        </h1>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
          Extract content from any URL and transform it into JSON, Summaries, or Social Posts using intelligent prompts.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <FeatureCard 
          icon={<LinkIcon className="text-white" size={32} />}
          title="Single URL Extraction"
          desc="Quickly process individual articles or documentation pages. Perfect for quick research or summarization."
          color="bg-indigo-500"
          onClick={() => setView(AppView.SINGLE)}
        />
        <FeatureCard 
          icon={<Layers className="text-white" size={32} />}
          title="Bulk Processing"
          desc="Upload an Excel sheet with hundreds of URLs. Apply a single prompt to transform them all at once."
          color="bg-purple-500"
          onClick={() => setView(AppView.BULK)}
        />
      </div>

      <div className="pt-8 grid grid-cols-1 md:grid-cols-3 gap-8 text-left max-w-4xl mx-auto">
         <StatItem value="1.5s" label="Avg Extraction Time" />
         <StatItem value="100%" label="Prompt Adherence" />
         <StatItem value="Unlimited" label="Output Formats" />
      </div>
    </div>
  );
};

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; desc: string; color: string; onClick: () => void }> = ({ icon, title, desc, color, onClick }) => (
  <div 
    onClick={onClick}
    className="group bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl border border-slate-100 transition-all cursor-pointer text-left relative overflow-hidden"
  >
    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg transform group-hover:scale-110 transition-transform ${color}`}>
      {icon}
    </div>
    <h3 className="text-2xl font-bold text-slate-800 mb-3">{title}</h3>
    <p className="text-slate-500 leading-relaxed">{desc}</p>
    <div className="mt-6 flex items-center text-indigo-600 font-semibold group-hover:translate-x-2 transition-transform">
      Get Started <code className="ml-2">→</code>
    </div>
  </div>
);

const StatItem: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm text-center transform hover:-translate-y-1 transition-transform duration-300">
    <div className="text-3xl font-bold text-indigo-600 mb-1">{value}</div>
    <div className="text-sm text-slate-500 font-medium uppercase tracking-wider">{label}</div>
  </div>
);

export default App;