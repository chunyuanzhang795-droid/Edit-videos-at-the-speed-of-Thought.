import { EditSegment, SegmentAction } from '../types';

export const exportProcessedVideo = async (
  videoUrl: string,
  segments: EditSegment[],
  onProgress: (pct: number) => void
): Promise<{ blob: Blob, extension: string }> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.crossOrigin = 'anonymous';
    video.muted = false; // Required to capture audio track
    video.playsInline = true;
    
    // Set to 1080p resolution dimensions
    video.width = 1920;
    video.height = 1080;
    
    // Hide the video but append to DOM to ensure standard behavior
    video.style.position = 'fixed';
    video.style.top = '-9999px';
    video.style.left = '-9999px';
    video.style.width = '1920px'; 
    video.style.height = '1080px';
    document.body.appendChild(video);

    video.onloadedmetadata = () => {
      startExport();
    };

    video.onerror = (e) => {
      cleanup();
      reject(new Error("Failed to load video for export"));
    };

    let mediaRecorder: MediaRecorder | null = null;
    const chunks: Blob[] = [];
    let currentSegmentIndex = 0;

    function cleanup() {
      if (video.parentNode) document.body.removeChild(video);
      if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    }

    async function startExport() {
      try {
        // 1. Setup Stream at 30fps
        // Note: captureStream() captures what is rendered.
        const stream = (video as any).captureStream ? (video as any).captureStream(30) : (video as any).mozCaptureStream(30);
        
        // 2. Setup Recorder
        // Prioritize MP4, then VP9 WebM, then Standard WebM
        let mimeType = 'video/webm';
        let extension = 'webm';

        if (MediaRecorder.isTypeSupported('video/mp4')) {
            mimeType = 'video/mp4';
            extension = 'mp4';
        } else if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) {
            mimeType = 'video/webm; codecs=vp9';
            extension = 'webm';
        }
            
        mediaRecorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 8000000 // 8 Mbps target for 1080p
        });

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          cleanup();
          resolve({ blob, extension });
        };

        // 3. Start processing
        mediaRecorder.start();
        processNextSegment();

      } catch (err) {
        cleanup();
        reject(err);
      }
    }

    function processNextSegment() {
      if (currentSegmentIndex >= segments.length) {
        mediaRecorder?.stop();
        return;
      }

      const seg = segments[currentSegmentIndex];
      const progress = Math.min(100, Math.round((currentSegmentIndex / segments.length) * 100));
      onProgress(progress);

      // SKIP DELETED SEGMENTS
      if (seg.action === SegmentAction.DELETE) {
        currentSegmentIndex++;
        // Use setTimeout to avoid recursion stack overflow on long sequences of cuts
        setTimeout(processNextSegment, 0);
        return;
      }

      // LOGIC FOR PLAYING SEGMENT
      // We need to: Seek -> Wait for Seek -> Play -> Wait for End -> Pause -> Next
      
      const onSeeked = () => {
        // 1. Set Speed
        video.playbackRate = seg.speed;
        
        let isPlaying = false;

        // 2. Define Stop Condition
        const checkEnd = () => {
          if (video.paused || video.ended) return;
          
          // CRITICAL FIX: Do not pause if we haven't fully started playing yet.
          if (!isPlaying) return;

          if (video.currentTime >= seg.end) {
            video.pause();
            video.removeEventListener('timeupdate', checkEnd);
            currentSegmentIndex++;
            processNextSegment();
          }
        };

        video.addEventListener('timeupdate', checkEnd);
        
        // 3. Start Playing with Promise handling
        const playPromise = video.play();
        
        if (playPromise !== undefined) {
            playPromise
            .then(() => {
                isPlaying = true;
                // Immediate check in case the segment was extremely short 
                // and timeupdate hasn't fired yet or we overshot.
                if (video.currentTime >= seg.end) {
                     video.pause();
                     video.removeEventListener('timeupdate', checkEnd);
                     currentSegmentIndex++;
                     processNextSegment();
                }
            })
            .catch(error => {
                 // If error is AbortError, it usually means we paused/seeked explicitly, 
                 // which is fine if controlled, but here we want to report unexpected failures.
                 if (error.name !== 'AbortError') {
                    cleanup();
                    reject(new Error("Playback failed during export: " + error.message));
                 }
            });
        } else {
            // Fallback for older browsers that don't return Promise
            isPlaying = true;
        }
      };

      // Handle Seeking
      // If we are already at the start (or very close), don't wait for seeked event
      // as it might not fire if delta is 0.
      if (Math.abs(video.currentTime - seg.start) < 0.05) {
         onSeeked();
      } else {
         video.addEventListener('seeked', onSeeked, { once: true });
         video.currentTime = seg.start;
      }
    }
  });
};