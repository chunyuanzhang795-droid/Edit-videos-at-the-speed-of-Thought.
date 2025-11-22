
import React, { useMemo } from 'react';
import { EditSegment, SegmentAction, SegmentType } from '../types';

interface TimelineProps {
  segments: EditSegment[];
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  highlightedIndex?: number | null;
}

const Timeline: React.FC<TimelineProps> = ({ segments, currentTime, duration, onSeek, highlightedIndex }) => {
  
  // Calculate colors for visualization
  const getSegmentColor = (segment: EditSegment) => {
    if (segment.action === SegmentAction.DELETE) return 'bg-red-500/20 border-red-500/50';
    switch (segment.type) {
      case SegmentType.CORE: return 'bg-green-500/60 border-green-500'; // 1.0x
      case SegmentType.CONTEXT: return 'bg-blue-500/60 border-blue-500'; // 1.2x - 1.5x
      case SegmentType.MECHANICAL: return 'bg-purple-500/60 border-purple-500'; // Fast
      default: return 'bg-gray-500';
    }
  };

  const sortedSegments = useMemo(() => {
    return [...segments].sort((a, b) => a.start - b.start);
  }, [segments]);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedTime = (x / rect.width) * duration;
    onSeek(clickedTime);
  };

  if (duration === 0) return null;

  return (
    <div className="w-full max-w-4xl mx-auto mt-6 select-none">
        <div className="flex justify-between text-xs text-gray-400 mb-2 font-mono">
            <span>00:00</span>
            <span>SMART EDIT TIMELINE</span>
            <span>{new Date(duration * 1000).toISOString().substr(14, 5)}</span>
        </div>
        
        <div 
            className="relative h-14 bg-gray-900 rounded-lg cursor-pointer overflow-visible border border-gray-700"
            onClick={handleTimelineClick}
        >
            {/* Base Track */}
            <div className="absolute inset-0 overflow-hidden rounded-lg">
                {sortedSegments.map((seg, idx) => {
                    const left = (seg.start / duration) * 100;
                    const width = ((seg.end - seg.start) / duration) * 100;
                    const isHighlighted = idx === highlightedIndex;
                    
                    return (
                        <div
                            key={idx}
                            className={`absolute top-0 bottom-0 border-r transition-all duration-200 
                            ${getSegmentColor(seg)} 
                            ${isHighlighted ? 'z-20 opacity-100 brightness-150 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'opacity-90 hover:brightness-110'}
                            `}
                            style={{ 
                                left: `${left}%`, 
                                width: `${width}%`,
                                height: isHighlighted ? '100%' : '100%',
                            }}
                        >
                             {/* Highlight Border Overlay */}
                             {isHighlighted && (
                                <div className="absolute inset-0 border-2 border-yellow-400 animate-pulse z-30 pointer-events-none"></div>
                             )}

                            {width > 5 && (
                                <span className="absolute top-1 left-1 text-[8px] font-bold text-white opacity-70 uppercase truncate w-full px-1">
                                    {seg.action === 'DELETE' ? 'CUT' : `${seg.speed}x`}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Playhead */}
            <div 
                className="absolute top-0 bottom-0 w-0.5 bg-white z-40 shadow-[0_0_10px_rgba(255,255,255,0.8)] pointer-events-none"
                style={{ left: `${(currentTime / duration) * 100}%` }}
            />
        </div>

        <div className="flex gap-4 mt-4 justify-center">
            <LegendItem color="bg-green-500" label="Core (1.0x)" />
            <LegendItem color="bg-blue-500" label="Context (1.2x-1.5x)" />
            <LegendItem color="bg-purple-500" label="Fast Fwd (2x+)" />
            <LegendItem color="bg-red-500/50" label="Auto-Cut" />
        </div>
    </div>
  );
};

const LegendItem = ({ color, label }: { color: string, label: string }) => (
    <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${color}`} />
        <span className="text-xs text-gray-400">{label}</span>
    </div>
);

export default Timeline;
