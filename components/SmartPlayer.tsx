
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { EditSegment, SegmentAction } from '../types';
import { Play, Pause, RefreshCw } from 'lucide-react';

interface SmartPlayerProps {
  videoUrl: string;
  segments: EditSegment[];
  onTimeUpdate?: (currentTime: number) => void;
  stopAt?: number | null;
  onStopReached?: () => void;
}

const SmartPlayer: React.FC<SmartPlayerProps> = ({ 
  videoUrl, 
  segments, 
  onTimeUpdate, 
  stopAt,
  onStopReached 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(1.0);
  const [currentAction, setCurrentAction] = useState<string>("");
  const [currentReason, setCurrentReason] = useState<string>("");

  // Find the active segment based on time
  const getActiveSegment = useCallback((time: number) => {
    return segments.find(s => time >= s.start && time < s.end);
  }, [segments]);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  // The core logic loop
  const updateLoop = useCallback(() => {
    if (!videoRef.current) return;
    
    const time = videoRef.current.currentTime;
    if (onTimeUpdate) onTimeUpdate(time);

    // Check Stop Condition (for Segment Preview)
    if (stopAt !== null && stopAt !== undefined) {
        // Use a small buffer to ensure we catch the end
        if (time >= stopAt) {
            videoRef.current.pause();
            setIsPlaying(false);
            if (onStopReached) onStopReached();
            return; // Exit loop for this frame
        }
    }

    const segment = getActiveSegment(time);

    if (segment) {
      setCurrentReason(segment.summary);
      setCurrentAction(segment.type);

      if (segment.action === SegmentAction.DELETE) {
        // Skip logic
        videoRef.current.currentTime = segment.end + 0.01; 
      } else {
        // Speed logic
        if (Math.abs(videoRef.current.playbackRate - segment.speed) > 0.1) {
          videoRef.current.playbackRate = segment.speed;
          setCurrentSpeed(segment.speed);
        }
      }
    } else {
      // Default fallback if gaps exist
      if (videoRef.current.playbackRate !== 1) {
        videoRef.current.playbackRate = 1;
        setCurrentSpeed(1);
      }
    }

    animationFrameRef.current = requestAnimationFrame(updateLoop);
  }, [segments, getActiveSegment, onTimeUpdate, stopAt, onStopReached]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateLoop);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, updateLoop]);

  // Reset on new video
  useEffect(() => {
    if(videoRef.current) {
        videoRef.current.playbackRate = 1;
        setCurrentSpeed(1);
    }
  }, [videoUrl]);

  return (
    <div className="relative w-full max-w-4xl mx-auto bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-700 group">
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-auto max-h-[60vh] object-contain"
        onClick={handlePlayPause}
        onEnded={() => setIsPlaying(false)}
        playsInline
      />
      
      {/* HUD Overlay */}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-2 pointer-events-none">
         <div className={`px-3 py-1 rounded-md text-xs font-mono font-bold uppercase transition-colors duration-300 ${
            currentSpeed > 1.5 ? 'bg-purple-600 text-white' : 
            currentSpeed > 1.0 ? 'bg-blue-600 text-white' : 
            'bg-gray-800/80 text-gray-300'
         }`}>
            Speed: {currentSpeed.toFixed(1)}x
         </div>
         {currentAction && (
             <div className="px-3 py-1 rounded-md bg-black/60 backdrop-blur-sm border border-gray-700 text-xs text-gray-200 max-w-[200px] text-right">
                <span className="text-brand-400 font-bold">{currentAction}</span>
                <div className="opacity-75 truncate">{currentReason}</div>
             </div>
         )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="flex items-center justify-center gap-4">
            <button 
                onClick={() => {
                    if(videoRef.current) videoRef.current.currentTime = 0;
                }}
                className="p-2 rounded-full bg-gray-700/50 hover:bg-gray-600 text-white"
            >
                <RefreshCw size={20} />
            </button>
            <button 
                onClick={handlePlayPause}
                className="p-4 rounded-full bg-brand-500 hover:bg-brand-400 text-white shadow-lg shadow-brand-500/30 transition-all transform hover:scale-105"
            >
                {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            </button>
        </div>
      </div>
    </div>
  );
};

export default SmartPlayer;
