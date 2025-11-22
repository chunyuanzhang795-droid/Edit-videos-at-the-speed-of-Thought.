import React, { useCallback } from 'react';
import { UploadCloud, Film } from 'lucide-react';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

const UploadZone: React.FC<UploadZoneProps> = ({ onFileSelect, isProcessing }) => {
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        onFileSelect(file);
      } else {
        alert('Please upload a video file.');
      }
    }
  }, [onFileSelect, isProcessing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div 
        className={`w-full max-w-2xl mx-auto h-64 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all duration-300
        ${isProcessing 
            ? 'border-gray-600 bg-gray-800/30 opacity-50 cursor-not-allowed' 
            : 'border-gray-600 bg-gray-800/50 hover:border-brand-400 hover:bg-gray-800/80 cursor-pointer'
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
    >
        <input 
            type="file" 
            accept="video/*" 
            className="hidden" 
            id="video-upload"
            onChange={handleChange}
            disabled={isProcessing}
        />
        <label htmlFor="video-upload" className="flex flex-col items-center cursor-pointer w-full h-full justify-center">
            <div className={`p-4 rounded-full bg-gray-700 mb-4 ${isProcessing ? 'animate-pulse' : 'text-brand-400'}`}>
                {isProcessing ? <Film className="animate-spin" size={32} /> : <UploadCloud size={32} />}
            </div>
            <h3 className="text-xl font-semibold text-gray-200 mb-2">
                {isProcessing ? 'Uploading & Analyzing...' : 'Upload Video to Edit'}
            </h3>
            <p className="text-sm text-gray-400 text-center max-w-xs">
                Drag and drop MP4, WebM, or MOV. <br/>
                <span className="text-xs text-gray-500">Supports larger files depending on browser memory.</span>
            </p>
        </label>
    </div>
  );
};

export default UploadZone;