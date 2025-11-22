
import React, { useState, useEffect } from 'react';
import { Sparkles, AlertCircle, Scissors, Download, Loader2, Play, RefreshCw, Upload, Split } from 'lucide-react';
import UploadZone from './components/UploadZone';
import SmartPlayer from './components/SmartPlayer';
import Timeline from './components/Timeline';
import { analyzeVideo, refineSegment } from './services/geminiService';
import { exportProcessedVideo } from './services/videoExport';
import { AppState, EditSegment, SegmentAction } from './types';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [segments, setSegments] = useState<EditSegment[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [analysisTime, setAnalysisTime] = useState(0);
  
  // Interaction State
  const [stopAt, setStopAt] = useState<number | null>(null);
  const [highlightedIdx, setHighlightedIdx] = useState<number | null>(null);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Clean up object URL
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    setVideoUrl(url);
    
    // Get duration for timeline
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
        setVideoDuration(video.duration);
    };
    video.src = url;

    // Start Analysis
    setState(AppState.ANALYZING);
    setErrorMsg("");
    
    const startTime = Date.now();

    try {
      const resultSegments = await analyzeVideo(selectedFile);
      setSegments(resultSegments);
      setAnalysisTime((Date.now() - startTime) / 1000);
      setState(AppState.READY);
    } catch (err: any) {
        console.error(err);
        setState(AppState.ERROR);
        setErrorMsg(err.message || "Failed to analyze video. Please check your API key.");
    }
  };

  const handleExport = async () => {
    if (!videoUrl || segments.length === 0) return;
    
    setIsExporting(true);
    setExportProgress(0);

    try {
        const { blob, extension } = await exportProcessedVideo(videoUrl, segments, (pct) => {
            setExportProgress(pct);
        });

        // Download logic
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `smartcut_edited_${Date.now()}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err: any) {
        console.error("Export failed", err);
        alert("Export failed: " + err.message + "\nPlease keep the tab active during export.");
    } finally {
        setIsExporting(false);
    }
  };

  // Edit Functionality
  const updateSegment = (index: number, updates: Partial<EditSegment>) => {
    const newSegments = [...segments];
    newSegments[index] = { ...newSegments[index], ...updates };
    setSegments(newSegments);
  };

  const handleSplitSegment = async (index: number) => {
    if (!file) return;
    const targetSegment = segments[index];
    
    // Mark as processing
    updateSegment(index, { isProcessing: true });

    try {
      const newSubSegments = await refineSegment(file, targetSegment.start, targetSegment.end);
      
      if (newSubSegments && newSubSegments.length > 0) {
        const newSegments = [...segments];
        // Replace the single segment with the new array of sub-segments
        newSegments.splice(index, 1, ...newSubSegments);
        setSegments(newSegments);
      } else {
        // Revert loading state if no splits returned
         updateSegment(index, { isProcessing: false });
      }
    } catch (err) {
      console.error("Split failed", err);
      alert("Failed to split segment. Please try again.");
      updateSegment(index, { isProcessing: false });
    }
  };

  const handleSeek = (time: number) => {
    setStopAt(null); // Clear any auto-stop
    const videoEl = document.querySelector('video');
    if (videoEl) {
        videoEl.currentTime = time;
        videoEl.play();
    }
  };

  const handlePlaySegment = (index: number) => {
    const seg = segments[index];
    setHighlightedIdx(index);
    setStopAt(seg.end); // Tell SmartPlayer to stop here
    
    const videoEl = document.querySelector('video');
    if (videoEl) {
        videoEl.currentTime = seg.start;
        videoEl.play();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Stats Calculation
  const stats = React.useMemo(() => {
    if (segments.length === 0) return { cutTime: 0, speedupRatio: 0, timeSaved: 0, finalDuration: 0 };
    
    let cutDuration = 0;
    let originalTotal = 0;
    let weightedDuration = 0;

    segments.forEach(seg => {
        const duration = seg.end - seg.start;
        originalTotal += duration;
        if (seg.action === SegmentAction.DELETE) {
            cutDuration += duration;
        } else {
            weightedDuration += duration / seg.speed;
        }
    });

    // Estimate final duration
    const estimatedFinal = weightedDuration;
    const timeSaved = originalTotal - estimatedFinal;

    return {
        cutTime: cutDuration,
        timeSaved,
        finalDuration: estimatedFinal
    };
  }, [segments]);

  const resetApp = () => {
    setState(AppState.IDLE);
    setFile(null);
    setSegments([]);
    setErrorMsg("");
    setHighlightedIdx(null);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-gray-100 flex flex-col font-sans selection:bg-brand-500/30">
      
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0f172a]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={resetApp}>
                <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center shadow-lg shadow-brand-500/20">
                    <Scissors size={18} className="text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    SmartCut<span className="text-brand-400">.ai</span>
                </span>
            </div>
            <div className="flex gap-4 text-sm font-medium text-gray-400 items-center">
                {state === AppState.READY && (
                    <button 
                        onClick={resetApp}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-md transition-all text-xs sm:text-sm border border-gray-700"
                    >
                        <Upload size={14} />
                        <span className="hidden sm:inline">Upload New Video</span>
                    </button>
                )}
                <div className="h-4 w-px bg-gray-700 hidden sm:block"></div>
                <span className="hidden sm:inline">Auto-Cleanup</span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline">Dynamic Speed</span>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center p-6">
        
        {state === AppState.IDLE && (
            <div className="mt-10 w-full animate-in fade-in zoom-in duration-500">
                <div className="text-center mb-12">
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
                        Edit videos at the speed of <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-accent-500">Thought.</span>
                    </h1>
                    <p className="text-gray-400 max-w-lg mx-auto text-lg">
                        Upload a raw clip. We use Gemini 2.5 Multimodal AI to remove silence, cut filler, and dynamically speed up boring parts.
                    </p>
                </div>
                <UploadZone onFileSelect={handleFileSelect} isProcessing={false} />
                {errorMsg && (
                    <div className="max-w-md mx-auto mt-4 p-4 bg-red-900/20 border border-red-800 rounded-lg flex items-center gap-3 text-red-200">
                        <AlertCircle size={20} />
                        <p className="text-sm">{errorMsg}</p>
                    </div>
                )}
            </div>
        )}

        {state === AppState.ANALYZING && (
            <div className="flex flex-col items-center justify-center h-[50vh] space-y-6">
                <div className="relative">
                    <div className="absolute inset-0 bg-brand-500/20 blur-xl rounded-full animate-pulse"></div>
                    <div className="w-16 h-16 border-4 border-gray-700 border-t-brand-500 rounded-full animate-spin relative z-10"></div>
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-white">Analyzing Information Density...</h2>
                    <p className="text-gray-400">Detecting speech patterns, visual context, and redundancies.</p>
                </div>
            </div>
        )}

        {(state === AppState.READY || state === AppState.ERROR) && videoUrl && (
             <div className="w-full max-w-6xl space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20">
                
                {/* Stats & Action Header */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 flex flex-col items-center justify-center">
                        <span className="text-gray-400 text-xs uppercase tracking-wider mb-1">Processing Time</span>
                        <span className="text-2xl font-bold text-white">{analysisTime.toFixed(1)}s</span>
                    </div>
                    <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 flex flex-col items-center justify-center">
                        <span className="text-gray-400 text-xs uppercase tracking-wider mb-1">Removed</span>
                        <span className="text-2xl font-bold text-red-400">
                            {stats.cutTime.toFixed(1)}s
                        </span>
                    </div>
                    <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 flex flex-col items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-brand-500/5"></div>
                         <span className="text-gray-400 text-xs uppercase tracking-wider mb-1">Time Saved</span>
                        <span className="text-2xl font-bold text-brand-400">
                           {stats.timeSaved.toFixed(1)}s
                        </span>
                    </div>
                     <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 flex flex-col items-center justify-center">
                         <button 
                            onClick={handleExport}
                            disabled={isExporting}
                            className={`w-full h-full flex items-center justify-center gap-2 rounded-lg font-bold transition-all px-4
                            ${isExporting 
                                ? 'bg-gray-700 text-gray-400 cursor-wait' 
                                : 'bg-white text-black hover:bg-gray-200 hover:scale-105 shadow-lg shadow-white/10'
                            }`}
                         >
                            {isExporting ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    <span className="text-sm">{exportProgress}%</span>
                                </>
                            ) : (
                                <>
                                    <Download size={20} />
                                    <div className="flex flex-col items-start leading-none">
                                        <span className="text-sm">Download Video</span>
                                        <span className="text-[10px] font-normal text-gray-600">1080p • MP4/WebM</span>
                                    </div>
                                </>
                            )}
                         </button>
                    </div>
                </div>

                {state === AppState.ERROR ? (
                    <div className="text-center p-10 border border-red-800 bg-red-900/10 rounded-xl">
                        <h3 className="text-xl font-bold text-red-400 mb-2">Analysis Failed</h3>
                        <p className="text-gray-300">{errorMsg}</p>
                        <button onClick={resetApp} className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">Try Again</button>
                    </div>
                ) : (
                    <>
                        <SmartPlayer 
                            videoUrl={videoUrl} 
                            segments={segments}
                            onTimeUpdate={setCurrentTime}
                            stopAt={stopAt}
                            onStopReached={() => setStopAt(null)}
                        />
                        
                        <Timeline 
                            segments={segments} 
                            currentTime={currentTime} 
                            duration={videoDuration || 1}
                            onSeek={handleSeek}
                            highlightedIndex={highlightedIdx}
                        />

                        <div className="mt-8 bg-gray-900/50 rounded-xl p-6 border border-gray-800">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Sparkles size={16} className="text-brand-400"/> 
                                Edit Decisions
                            </h3>
                            
                            <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                                {segments.map((seg, i) => (
                                    <div 
                                        key={i} 
                                        onMouseEnter={() => setHighlightedIdx(i)}
                                        onMouseLeave={() => setHighlightedIdx(null)}
                                        className={`group flex flex-col md:flex-row gap-3 p-3 rounded-lg border transition-all ${
                                        seg.action === SegmentAction.DELETE 
                                        ? 'bg-red-900/10 border-red-900/30' 
                                        : i === highlightedIdx 
                                            ? 'bg-gray-800/80 border-yellow-500/50 shadow-sm shadow-yellow-500/10'
                                            : 'bg-gray-800/40 border-gray-700/50'
                                    }`}>
                                        {/* Time & Preview Play */}
                                        <button 
                                            onClick={() => handlePlaySegment(i)}
                                            className={`flex items-center gap-2 min-w-[120px] text-xs font-mono transition-colors text-left
                                                ${i === highlightedIdx ? 'text-brand-400' : 'text-gray-400 hover:text-brand-400'}
                                            `}
                                            title="Play this segment only"
                                        >
                                            <div className={`p-1 rounded-full ${i === highlightedIdx ? 'bg-brand-500/20' : 'bg-transparent'}`}>
                                                <Play size={10} className={i === highlightedIdx ? 'fill-current' : ''} />
                                            </div>
                                            {formatTime(seg.start)} - {formatTime(seg.end)}
                                        </button>

                                        {/* Content Info */}
                                        <div className="flex-grow flex flex-col justify-center">
                                            <div className="flex items-center gap-2 mb-1">
                                                 <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
                                                     seg.type === 'CORE' ? 'bg-green-500/20 text-green-400' :
                                                     seg.type === 'CONTEXT' ? 'bg-blue-500/20 text-blue-400' :
                                                     seg.type === 'MECHANICAL' ? 'bg-purple-500/20 text-purple-400' :
                                                     'bg-gray-700 text-gray-400'
                                                 }`}>
                                                     {seg.type}
                                                 </span>
                                            </div>
                                            <p className={`text-sm leading-snug ${seg.action === SegmentAction.DELETE ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                                                {seg.summary}
                                            </p>
                                        </div>

                                        {/* Interactive Controls */}
                                        <div className="flex flex-wrap items-center gap-2 border-l border-gray-700 pl-3 md:min-w-[300px] justify-end">
                                            
                                            {/* Loading State */}
                                            {seg.isProcessing && (
                                                <div className="flex items-center gap-2 px-3 py-1 text-xs text-brand-400">
                                                    <Loader2 size={12} className="animate-spin" />
                                                    Splitting...
                                                </div>
                                            )}

                                            {!seg.isProcessing && (
                                                <>
                                                    {/* Split Button */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // Prevent hover flicker/issues
                                                            handleSplitSegment(i);
                                                        }}
                                                        title="Split into sentence-level segments"
                                                        className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                                                    >
                                                        <Split size={14} className="transform -rotate-90" />
                                                    </button>

                                                    {/* Action Toggle */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            updateSegment(i, { action: seg.action === SegmentAction.DELETE ? SegmentAction.KEEP : SegmentAction.DELETE });
                                                        }}
                                                        className={`px-3 py-1 rounded-md text-xs font-bold uppercase transition-colors ${
                                                            seg.action === SegmentAction.DELETE 
                                                            ? 'bg-red-500 text-white shadow-lg shadow-red-900/50' 
                                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                        }`}
                                                    >
                                                        {seg.action === SegmentAction.DELETE ? 'Deleted' : 'Keep'}
                                                    </button>

                                                    {/* Speed Selector */}
                                                    <div className={`flex items-center bg-gray-900 rounded-lg p-1 ${seg.action === SegmentAction.DELETE ? 'opacity-25 pointer-events-none' : 'opacity-100'}`}>
                                                        {[1.0, 1.2, 1.5, 2.0, 5.0].map(speed => (
                                                            <button
                                                                key={speed}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    updateSegment(i, { speed });
                                                                }}
                                                                className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                                                                    Math.abs(seg.speed - speed) < 0.1
                                                                    ? 'bg-brand-500 text-white shadow-sm' 
                                                                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                                                                }`}
                                                            >
                                                                {speed}x
                                                            </button>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
             </div>
        )}
      </main>
    </div>
  );
};

export default App;
