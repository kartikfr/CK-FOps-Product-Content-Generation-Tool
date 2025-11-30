import React, { useState, useEffect } from 'react';
import { AppView } from './types';
import { SingleUrlProcessor } from './components/SingleUrlProcessor';
import { BulkUrlProcessor } from './components/BulkUrlProcessor';
import { Link as LinkIcon, Layers, Bot, Sparkles } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.HOME);
  const [showIntro, setShowIntro] = useState(true);
  const [introOpacity, setIntroOpacity] = useState(1);

  // Intro Animation Logic
  useEffect(() => {
    // Start fading out after 2 seconds
    const fadeTimer = setTimeout(() => {
      setIntroOpacity(0);
    }, 2000);

    // Remove from DOM after 2.5 seconds (fade duration)
    const removeTimer = setTimeout(() => {
      setShowIntro(false);
    }, 2500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

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