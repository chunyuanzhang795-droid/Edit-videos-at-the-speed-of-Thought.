
export enum SegmentType {
  CORE = 'CORE',         // 1.0x - Important content
  CONTEXT = 'CONTEXT',   // 1.2x-1.5x - Low density / Fluff
  MECHANICAL = 'MECHANICAL', // 2.0x-5.0x - Visual transition / Typing
  SILENCE = 'SILENCE',   // DELETE
  FILLER = 'FILLER',     // DELETE
}

export enum SegmentAction {
  KEEP = 'KEEP',
  DELETE = 'DELETE',
}

export interface EditSegment {
  start: number;   // Start time in seconds
  end: number;     // End time in seconds
  speed: number;   // Playback rate (e.g., 1.0, 1.5, 5.0)
  action: SegmentAction;
  type: SegmentType;
  summary: string; // Reasoning for the edit
  isProcessing?: boolean; // UI state for re-segmentation
}

export interface AnalysisResult {
  segments: EditSegment[];
  totalOriginalDuration: number;
  totalEditedDuration: number;
}

export enum AppState {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  ANALYZING = 'ANALYZING',
  READY = 'READY',
  ERROR = 'ERROR',
}
