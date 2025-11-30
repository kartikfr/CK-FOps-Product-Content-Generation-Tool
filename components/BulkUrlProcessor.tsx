import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
import { BulkJobItem, SampleFile } from '../types';
import { scrapeUrl } from '../services/scraperService';
import { transformContent } from '../services/geminiService';
import { Upload, Play, Download, AlertCircle, CheckCircle2, Loader2, FileSpreadsheet, XCircle, FileText, X, FileDown, Info } from 'lucide-react';

export const BulkUrlProcessor: React.FC = () => {
  const [jobs, setJobs] = useState<BulkJobItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [prompt, setPrompt] = useState('');
  const [sampleFile, setSampleFile] = useState<SampleFile | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived state for progress tracking
  const totalJobs = jobs.length;
  const completedJobs = jobs.filter(j => {
      // A job is complete if scraping failed, OR if scraping succeeded and transformation finished (or wasn't needed)
      if (j.scrapeStatus === 'failed') return true;
      if (j.scrapeStatus === 'success') {
          if (prompt || sampleFile) {
              return j.transformStatus === 'success' || j.transformStatus === 'failed';
          }
          return true;
      }
      return false;
  }).length;
  
  const progressPercent = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

  const handleUrlFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json<{ URL?: string; url?: string }>(ws);

      const newJobs: BulkJobItem[] = data
        .map((row, idx) => {
           const url = row.URL || row.url;
           if (!url) return null;
           return {
             id: `job-${idx}-${Date.now()}`,
             url: url.trim(),
             scrapeStatus: 'idle',
             transformStatus: 'idle'
           };
        })
        .filter((job): job is BulkJobItem => job !== null);

      setJobs(newJobs);
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      { "URL": "https://www.amazon.com/dp/example1", "Label (Optional)": "Competitor Product A", "Notes (Optional)": "Focus on pricing" },
      { "URL": "https://www.example.com/blog/post1", "Label (Optional)": "Industry News", "Notes (Optional)": "Summarize key points" }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Bulk_Upload_Template.xlsx");
  };

  const handleSampleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // DOCX Handler
    if (file.name.endsWith('.docx')) {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const arrayBuffer = evt.target?.result;
        if (arrayBuffer && arrayBuffer instanceof ArrayBuffer) {
           try {
             const result = await mammoth.extractRawText({ arrayBuffer });
             setSampleFile({ name: file.name, content: result.value, type: 'docx' });
           } catch (err) {
             console.error("Failed to parse docx", err);
           }
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      if (typeof bstr !== 'string') return;
      
      let contentStr = '';
      let type: SampleFile['type'] = 'text';

      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        try {
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          contentStr = XLSX.utils.sheet_to_csv(ws);
          type = 'excel';
        } catch (e) {
          contentStr = bstr;
        }
      } else {
         contentStr = bstr;
      }

      setSampleFile({ name: file.name, content: contentStr, type });
    };
    
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        reader.readAsBinaryString(file);
    } else {
        reader.readAsText(file);
    }
  };

  const processJob = async (job: BulkJobItem) => {
    // Update status to scraping
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, scrapeStatus: 'pending' } : j));

    try {
      // 1. Scrape
      const scrapedData = await scrapeUrl(job.url);
      
      if (scrapedData.status === 'failed') {
         setJobs(prev => prev.map(j => j.id === job.id ? { ...j, scrapeStatus: 'failed', error: scrapedData.error } : j));
         return;
      }

      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, scrapeStatus: 'success', scrapedData } : j));

      // 2. Transform (if prompt or sample file exists)
      if (prompt || sampleFile) {
         setJobs(prev => prev.map(j => j.id === job.id ? { ...j, transformStatus: 'pending' } : j));
         
         const transformed = await transformContent(
             scrapedData.content, 
             prompt, 
             sampleFile?.content
         );
         
         setJobs(prev => prev.map(j => j.id === job.id ? { ...j, transformStatus: 'success', transformedData: transformed } : j));
      }

    } catch (err: any) {
       setJobs(prev => prev.map(j => j.id === job.id ? { 
         ...j, 
         scrapeStatus: 'failed', 
         transformStatus: 'failed', 
         error: err.message 
       } : j));
    }
  };

  const startProcessing = async () => {
    if (jobs.length === 0) return;
    if (!prompt && !sampleFile) {
        alert("Please provide a prompt OR a sample file to guide the transformation.");
        return;
    }
    
    setIsProcessing(true);

    // Process sequentially to be nice to API limits in this demo
    for (const job of jobs) {
      if (job.scrapeStatus === 'idle') {
        await processJob(job);
      }
    }
    setIsProcessing(false);
  };

  const downloadResults = () => {
    const dataToExport = jobs.map(j => ({
      URL: j.url,
      Status: j.transformStatus === 'success' ? 'Success' : 'Failed',
      OriginalTitle: j.scrapedData?.title || '',
      TransformedContent: j.transformedData || '',
      Error: j.error || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Results");
    XLSX.writeFile(wb, "Bulk_Analysis_Results.xlsx");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Loader2 className="animate-spin text-indigo-500" size={18} />;
      case 'success': return <CheckCircle2 className="text-green-500" size={18} />;
      case 'failed': return <XCircle className="text-red-500" size={18} />;
      default: return <div className="w-4 h-4 rounded-full border-2 border-slate-200" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="grid md:grid-cols-3 gap-6">
        {/* Left Col: Upload & Config */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4">
               <h3 className="font-semibold text-slate-800">1. Upload URL List</h3>
               <button 
                onClick={handleDownloadTemplate} 
                className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-700 hover:underline font-medium"
                title="Download Excel Template"
               >
                 <FileDown size={14} /> Template
               </button>
            </div>
            
            <div 
              className={`border-2 border-dashed border-slate-200 rounded-xl p-8 text-center transition-colors cursor-pointer group ${isProcessing ? 'opacity-50 pointer-events-none bg-slate-50' : 'hover:bg-slate-50'}`}
              onClick={() => !isProcessing && fileInputRef.current?.click()}
            >
              <FileSpreadsheet className="mx-auto text-indigo-500 mb-2 group-hover:scale-110 transition-transform" size={32} />
              <p className="text-sm font-medium text-slate-600">Click to upload Excel</p>
              <p className="text-xs text-slate-400 mt-1">.xlsx or .csv (Column 'URL')</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".xlsx,.xls,.csv" 
                onChange={handleUrlFileUpload}
                disabled={isProcessing}
              />
            </div>
            {jobs.length > 0 && (
              <div className="mt-4 flex items-center justify-between text-sm text-slate-600 bg-indigo-50 px-3 py-2 rounded-lg">
                <span>{jobs.length} URLs loaded</span>
                <button 
                  onClick={() => setJobs([])} 
                  className="text-red-500 hover:underline text-xs"
                  disabled={isProcessing}
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-800 mb-4">2. Configure Output</h3>
            
            <div className="mb-4">
                <label className="text-xs font-semibold text-slate-500 mb-2 block uppercase tracking-wider">A. Sample File (Optional)</label>
                <div className={`relative group ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
                    <input 
                        type="file" 
                        accept=".xlsx,.xls,.csv,.txt,.json,.docx"
                        onChange={handleSampleFileUpload}
                        disabled={isProcessing}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`border border-dashed rounded-lg p-3 flex items-center justify-center gap-2 transition-colors ${sampleFile ? 'bg-green-50 border-green-200' : 'border-slate-200 hover:bg-slate-50'}`}>
                         {sampleFile ? (
                             <div className="flex items-center justify-between w-full px-1">
                                 <div className="flex items-center gap-2 text-green-700 text-sm overflow-hidden">
                                    <FileSpreadsheet size={16} className="shrink-0"/>
                                    <span className="truncate max-w-[120px]">{sampleFile.name}</span>
                                 </div>
                                 <button onClick={(e) => {e.preventDefault(); setSampleFile(null);}} disabled={isProcessing} className="p-1 hover:bg-green-200 rounded-full text-green-600 z-20">
                                    <X size={14} />
                                 </button>
                             </div>
                         ) : (
                             <div className="flex items-center gap-2 text-slate-400 text-sm">
                                 <Upload size={16} /> <span>Upload Sample</span>
                             </div>
                         )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 ml-1">Supports DOCX, Excel, CSV, JSON</p>
                </div>
            </div>

            <div className="mb-4">
                <label className="text-xs font-semibold text-slate-500 mb-2 block uppercase tracking-wider">B. Custom Prompt</label>
                <textarea 
                className="w-full h-24 p-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm resize-none disabled:bg-slate-50 disabled:text-slate-400"
                placeholder="E.g. Format as valid JSON..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isProcessing}
                />
            </div>
            
            <button
              onClick={startProcessing}
              disabled={isProcessing || jobs.length === 0 || (!prompt && !sampleFile)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? <Loader2 className="animate-spin" /> : <Play size={18} fill="currentColor" />}
              {isProcessing ? 'Processing...' : 'Start Batch'}
            </button>
          </div>
        </div>

        {/* Right Col: Data Grid */}
        <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[600px]">
          <div className="p-6 border-b border-slate-100 flex flex-col gap-4">
             <div className="flex justify-between items-center">
                 <h3 className="font-semibold text-slate-800">Processing Queue</h3>
                 {jobs.some(j => j.transformStatus === 'success') && (
                   <button 
                    onClick={downloadResults}
                    className="text-sm flex items-center gap-2 text-green-600 hover:bg-green-50 px-3 py-1.5 rounded-lg transition-colors font-medium"
                   >
                     <Download size={16} /> Export Excel
                   </button>
                 )}
             </div>

             {/* Progress Bar Display */}
             {isProcessing && totalJobs > 0 && (
                 <div className="space-y-2 animate-in fade-in duration-300">
                    <div className="flex justify-between text-xs text-slate-500 font-medium">
                        <span>Processing item {Math.min(completedJobs + 1, totalJobs)} of {totalJobs}</span>
                        <span>{progressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div 
                            className="bg-indigo-600 h-full rounded-full transition-all duration-500 ease-out" 
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                 </div>
             )}
          </div>
          
          <div className="flex-1 overflow-auto p-0">
             {jobs.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-slate-400">
                 <Upload size={48} className="mb-4 opacity-20" />
                 <p>No jobs queued. Upload a file to begin.</p>
               </div>
             ) : (
               <table className="w-full text-sm text-left">
                 <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10">
                   <tr>
                     <th className="px-6 py-3 font-medium">URL</th>
                     <th className="px-6 py-3 font-medium w-32">Scrape</th>
                     <th className="px-6 py-3 font-medium w-32">Transform</th>
                     <th className="px-6 py-3 font-medium">Result Preview</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {jobs.map((job) => (
                     <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                       <td className="px-6 py-4 truncate max-w-[200px] text-slate-600" title={job.url}>{job.url}</td>
                       <td className="px-6 py-4">{getStatusIcon(job.scrapeStatus)}</td>
                       <td className="px-6 py-4">{getStatusIcon(job.transformStatus)}</td>
                       <td className="px-6 py-4 max-w-[300px]">
                         {job.error ? (
                           <div className="group relative cursor-help">
                             <div className="flex items-center gap-1.5 text-red-500 font-medium text-xs mb-0.5">
                                <AlertCircle size={14} /> 
                                <span>Failed</span>
                             </div>
                             <p className="truncate text-slate-400 text-[11px]" title={job.error}>
                               {job.error}
                             </p>
                           </div>
                         ) : (
                           <p className="truncate text-slate-500 font-mono text-xs" title={job.transformedData}>{job.transformedData || '-'}</p>
                         )}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};