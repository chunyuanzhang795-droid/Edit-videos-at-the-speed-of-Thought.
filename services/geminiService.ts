
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { EditSegment, SegmentType, SegmentAction } from '../types';

// Helper to convert file to Base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the Data URL prefix (e.g., "data:video/mp4;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

const segmentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    start: { type: Type.NUMBER, description: "Start time in seconds (Absolute timestamp)" },
    end: { type: Type.NUMBER, description: "End time in seconds (Absolute timestamp)" },
    speed: { type: Type.NUMBER, description: "Playback speed multiplier (e.g., 1.0, 1.2, 1.5, 2.0, 5.0)" },
    action: { type: Type.STRING, enum: ["KEEP", "DELETE"], description: "Whether to keep or delete this segment" },
    type: { 
      type: Type.STRING, 
      enum: ["CORE", "CONTEXT", "MECHANICAL", "SILENCE", "FILLER"],
      description: "The category of the content"
    },
    summary: { type: Type.STRING, description: "Brief reason for the decision" }
  },
  required: ["start", "end", "speed", "action", "type", "summary"]
};

const responseSchema: Schema = {
  type: Type.ARRAY,
  items: segmentSchema
};

export const analyzeVideo = async (file: File): Promise<EditSegment[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Data = await fileToBase64(file);

  const prompt = `
  Act as a world-class video editor. Analyze the provided video sequence and output a precise Edit Decision List (JSON).
  
  # GOAL
  Intelligently edit the video by removing redundancy and DYNAMICALLY ADJUSTING PLAYBACK SPEED based on information density.

  # RULES (Strict Priority)

  ## 1. CLEANUP (High Priority)
  - Identify redundancy, slips of the tongue, filler words ("um", "ah"), and repeated logic.
  - Identify "invalid footage" or "dead silence".
  - **ACTION**: Set 'action' to 'DELETE' for these.

  ## 2. DYNAMIC SPEED RAMPING (Core)
  Assign 'speed' based on "Information Density" and "Semantic Importance".
  
  ### A. Normal Speed (1.0x) - CORE CONTENT
  - Key conclusions, "Gold Nuggets", main points.
  - Complex operations requiring visual clarity.
  - Emotional expressions.
  - **MANDATORY**: First 5s and Last 5s.
  - **TYPE**: 'CORE'

  ### B. Slight Acceleration (1.2x - 1.5x) - LOW DENSITY
  - Long background introductions.
  - Slow speech rate (WPM < average).
  - Polite filler.
  - **TYPE**: 'CONTEXT'

  ### C. Fast Forward (2.0x - 5.0x) - MECHANICAL/VISUAL
  - Mechanical processes without speech.
  - Visual transitions, long camera pans.
  - **TYPE**: 'MECHANICAL'

  ## 3. SMOOTHNESS
  - Speed changes MUST occur at sentence or "thought unit" boundaries.
  - Ensure the timeline is continuous.

  Return ONLY the JSON array of segments.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType: file.type, data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.2,
      }
    });

    let text = response.text;
    if (!text) throw new Error("No response from Gemini");

    text = text.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    const segments = JSON.parse(text) as EditSegment[];
    segments.sort((a, b) => a.start - b.start);
    return segments;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

export const refineSegment = async (file: File, startTime: number, endTime: number): Promise<EditSegment[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Data = await fileToBase64(file);

  const prompt = `
  Analyze the video ONLY between timestamp ${startTime} seconds and ${endTime} seconds.
  
  # GOAL
  Break this specific segment down into smaller, sentence-level sub-segments ("sentences" or "phrases").
  
  # REQUIREMENT
  - Returns absolute timestamps (within the range ${startTime} to ${endTime}).
  - Apply the same Speed Ramping rules (1.0x for Core, 1.2x for Context, 2.0x+ for Mechanical).
  - Identify small silences or filler words within this block for potential deletion.
  - Ensure the new segments cover the entire range from ${startTime} to ${endTime} without gaps, unless the gap is explicitly DELETED.
  
  Return ONLY the JSON array of sub-segments.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType: file.type, data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.2,
      }
    });

    let text = response.text;
    if (!text) throw new Error("No response from Gemini");

    text = text.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    let segments = JSON.parse(text) as EditSegment[];
    
    // Safety check: ensure segments are within bounds
    segments = segments.map(s => ({
      ...s,
      start: Math.max(startTime, s.start),
      end: Math.min(endTime, s.end)
    }));
    
    segments.sort((a, b) => a.start - b.start);
    return segments;
  } catch (error) {
    console.error("Gemini Refinement Error:", error);
    throw error;
  }
};
