import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { scrapeUrl } from '../services/scraperService';
import { transformContent } from '../services/geminiService';
import { ScrapedContent, PromptTemplate, SampleFile } from '../types';
import { Loader2, ArrowRight, CheckCircle2, AlertCircle, Copy, FileCode, RefreshCw, Upload, FileSpreadsheet, X, FileText } from 'lucide-react';

const PROMPT_TEMPLATES: PromptTemplate[] = [
  { id: '1', name: 'Summarize', description: 'Create a concise executive summary', prompt: 'Create a 3-paragraph executive summary highlighting key points, main arguments, and conclusions.' },
  { id: '2', name: 'Product Details', description: 'Extract product specs', prompt: 'Extract Product Name, Price, Ingredients, Nutritional Info, and Features into a key-value list.' },
  { id: '3', name: 'JSON Extraction', description: 'Convert to structured JSON', prompt: 'Convert the main information to JSON with fields: title, summary, key_points (array), sentiment, and extracted_entities.' },
  { id: '4', name: 'Comparison Table', description: 'Markdown table of pros/cons', prompt: 'Create a Markdown comparison table based on the content, analyzing Pros vs Cons or Features vs Benefits.' },
];

export const SingleUrlProcessor: React.FC = () => {
  const [url, setUrl] = useState('');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [scrapedData, setScrapedData] = useState<ScrapedContent | null>(null);
  
  const [prompt, setPrompt] = useState('');
  const [sampleFile, setSampleFile] = useState<SampleFile | null>(null);
  
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await scrapeUrl(url);
      if (data.status === 'failed') {
        throw new Error(data.error || 'Failed to extract content');
      }
      setScrapedData(data);
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSampleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      if (typeof bstr !== 'string') return;

      let contentStr = '';
      let type: SampleFile['type'] = 'text';

      // Simple heuristic: if it looks like binary (Excel), parse it. If text/csv, use as is.
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        try {
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          contentStr = XLSX.utils.sheet_to_csv(ws); // Convert spreadsheet to CSV for the AI context
          type = 'excel';
        } catch (e) {
          contentStr = bstr;
        }
      } else if (file.name.endsWith('.json')) {
         contentStr = bstr;
         type = 'json';
      } else {
         contentStr = bstr;
         type = 'csv';
      }

      setSampleFile({
        name: file.name,
        content: contentStr,
        type
      });
    };
    
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        reader.readAsBinaryString(file);
    } else {
        reader.readAsText(file);
    }
  };

  const handleTransform = async () => {
    if (!scrapedData) return;
    if (!prompt && !sampleFile) {
        setError("Please provide either a prompt OR a sample file.");
        return;
    }

    setLoading(true);
    try {
      const output = await transformContent(
          scrapedData.content, 
          prompt, 
          sampleFile?.content
      );
      setResult(output);
      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result);
  };

  const downloadResult = () => {
     const blob = new Blob([result], { type: 'text/plain' });
     const url = window.URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     // Attempt to detect extension from sample file or prompt
     let ext = 'txt';
     if (sampleFile?.name.endsWith('.csv') || prompt.toLowerCase().includes('csv')) ext = 'csv';
     else if (sampleFile?.name.endsWith('.json') || prompt.toLowerCase().includes('json')) ext = 'json';
     
     a.download = `transformed_content.${ext}`;
     a.click();
     window.URL.revokeObjectURL(url);
  };

  const downloadDoc = () => {
      const filename = `${scrapedData?.title || 'Transformed_Content'}.doc`;
      
      // Since result is now "Clean Text", we simply format line breaks and headers
      // based on simple capitalization or spacing heuristics
      
      const lines = result.split('\n');
      let htmlBody = "";
      
      lines.forEach(line => {
          const trimmed = line.trim();
          if (!trimmed) return;
          
          // Simple heuristic: If line is short, uppercase, and no colon, treat as Header
          // Or if the line starts with a common header-like pattern
          if (trimmed.length < 50 && trimmed === trimmed.toUpperCase() && !trimmed.includes(':')) {
               htmlBody += `<h2>${trimmed}</h2>`;
          } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
               htmlBody += `<li>${trimmed.substring(2)}</li>`;
          } else if (trimmed.includes(':')) {
               // Bold the key part "Key: Value" -> "<b>Key:</b> Value"
               const parts = trimmed.split(':');
               if (parts.length > 1) {
                   const key = parts[0];
                   const val = parts.slice(1).join(':');
                   htmlBody += `<p><b>${key}:</b>${val}</p>`;
               } else {
                   htmlBody += `<p>${trimmed}</p>`;
               }
          } else {
               htmlBody += `<p>${trimmed}</p>`;
          }
      });
      
      const preHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${filename}</title><style>body{font-family: Arial; font-size: 11pt;} h2{font-size: 14pt; color: #2E4053; margin-top: 20px;} p{margin-bottom: 8px;} li{margin-left: 20px;}</style></head><body>`;
      const postHtml = "</body></html>";
      
      const html = preHtml + htmlBody + postHtml;

      const blob = new Blob(['\ufeff', html], {
          type: 'application/msword'
      });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* Progress Stepper */}
      <div className="flex justify-between items-center mb-8 px-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
              step >= s ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              {step > s ? <CheckCircle2 size={20} /> : s}
            </div>
            {s < 3 && <div className={`h-1 w-24 mx-2 ${step > s ? 'bg-indigo-600' : 'bg-slate-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Input */}
      {step === 1 && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Extract Content</h2>
          <p className="text-slate-500 mb-6">Enter a URL (Amazon, Flipkart, etc.) to scrape text, metadata, and product details.</p>
          
          <form onSubmit={handleScrape} className="space-y-4">
            <div className="relative">
              <input 
                type="url" 
                required
                placeholder="https://www.amazon.in/dp/..." 
                className="w-full pl-4 pr-12 py-4 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-lg"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            {error && (
              <div className="flex items-center text-red-500 text-sm mt-2">
                <AlertCircle size={16} className="mr-2" />
                {error}
              </div>
            )}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 rounded-xl transition-all flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Extract Content'}
            </button>
            <p className="text-xs text-center text-slate-400 mt-4">
              Supported: General Web Pages, Specialized parsing for Amazon, Flipkart, Myntra, Ajio products.
            </p>
          </form>
        </div>
      )}

      {/* Step 2: Transform */}
      {step === 2 && scrapedData && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 grid md:grid-cols-2 gap-8">
          <div className="border-r border-slate-100 pr-8">
             <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <FileCode size={18} className="text-indigo-500"/> Scraped Data Source
             </h3>
             <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-600 h-[500px] overflow-y-auto font-mono whitespace-pre-wrap">
                <p><strong>URL:</strong> {scrapedData.url}</p>
                <p><strong>Title:</strong> {scrapedData.title}</p>
                <div className="my-2 border-t border-slate-200" />
                {scrapedData.content}
             </div>
          </div>
          
          <div className="flex flex-col h-full space-y-6">
            <div>
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold text-slate-700">1. Sample Output File</h3>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Recommended</span>
                </div>
                <p className="text-xs text-slate-500 mb-2">Upload a file (Excel/CSV) showing exactly how you want the output format.</p>
                
                <div className="relative group">
                    <input 
                        type="file" 
                        accept=".xlsx,.xls,.csv,.txt,.json"
                        onChange={handleSampleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`border-2 border-dashed rounded-xl p-4 flex items-center justify-center gap-2 transition-colors ${sampleFile ? 'bg-green-50 border-green-200' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}>
                        {sampleFile ? (
                            <div className="flex items-center justify-between w-full px-2">
                                <div className="flex items-center gap-2 text-green-700">
                                    <FileSpreadsheet size={20} />
                                    <div className="flex flex-col text-left">
                                        <span className="font-medium truncate max-w-[150px]">{sampleFile.name}</span>
                                        <span className="text-xs text-green-600">Using as template</span>
                                    </div>
                                </div>
                                <button onClick={(e) => {e.preventDefault(); setSampleFile(null);}} className="p-1 hover:bg-green-200 rounded-full text-green-600 z-20">
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-1 text-slate-400 py-2">
                                <Upload size={24} />
                                <span className="text-sm">Click to upload sample file</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col">
                <h3 className="font-semibold text-slate-700 mb-2">2. Transformation Prompt</h3>
                <div className="flex gap-2 mb-2 overflow-x-auto pb-2 no-scrollbar">
                {PROMPT_TEMPLATES.map(t => (
                    <button 
                    key={t.id}
                    onClick={() => setPrompt(t.prompt)}
                    className="whitespace-nowrap px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs rounded-full hover:bg-indigo-100 transition-colors border border-indigo-100"
                    >
                    {t.name}
                    </button>
                ))}
                </div>
                <textarea 
                className="flex-1 w-full p-4 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none resize-none text-slate-700 text-sm"
                placeholder="E.g. 'Format this as a CSV list...' or 'Extract the ingredients and price...'"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                />
            </div>

            <button 
              onClick={handleTransform}
              disabled={loading || (!prompt.trim() && !sampleFile)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-all flex justify-center items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : <>Run Transformation <ArrowRight size={18} /></>}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Result */}
      {step === 3 && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
           <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800">Transformation Result</h2>
              <div className="flex gap-2">
                 <button 
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-2 transition-colors"
                >
                   <RefreshCw size={18} /> New
                </button>
                <button 
                  onClick={downloadDoc}
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-sm"
                >
                   <FileText size={18} /> Download .doc
                </button>
                 <button 
                  onClick={downloadResult}
                  className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg flex items-center gap-2 transition-colors font-medium"
                >
                   <Upload size={18} className="rotate-180"/> Text File
                </button>
                <button 
                  onClick={copyToClipboard}
                  className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg flex items-center gap-2 transition-colors font-medium"
                >
                   <Copy size={18} /> Copy
                </button>
              </div>
           </div>
           
           <div className="bg-slate-900 rounded-xl p-6 overflow-hidden relative group">
              <pre className="text-indigo-50 font-mono text-sm whitespace-pre-wrap break-words">{result}</pre>
           </div>
        </div>
      )}
    </div>
  );
};