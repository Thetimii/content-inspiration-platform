import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Pause, Info, CheckCircle, XCircle, Clock } from "lucide-react";
import { toast } from 'sonner';

interface VideoCardStreamingProps {
  video: {
    id: string;
    title: string;
    author: string;
    video_url: string;
    thumbnail_url: string;
    download_url?: string;
    frame_analysis?: string | null;
    last_analyzed_at?: string | null;
  };
  userId: string;
  onAnalysisComplete?: (videoId: string, analysis: string) => void;
}

export default function VideoCardStreaming({ video, userId, onAnalysisComplete }: VideoCardStreamingProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(video.frame_analysis || null);
  const [analysisStatus, setAnalysisStatus] = useState<string>('idle');
  const [streamMessages, setStreamMessages] = useState<any[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Check if analysis is already complete
  const isAnalysisComplete = analysis && analysis !== 'Analysis in progress...';
  const isAnalysisFailed = analysis && analysis.startsWith('Analysis failed:');

  // Handle play/pause
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Start streaming analysis
  const startStreamingAnalysis = async () => {
    try {
      setIsAnalyzing(true);
      setAnalysisStatus('starting');
      setStreamMessages([]);
      
      // Close any existing event source
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      
      // Create a new event source
      const response = await fetch('/api/stream-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: video.id
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start analysis stream');
      }
      
      // Get the response body as a readable stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get stream reader');
      }
      
      // Read the stream
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE messages
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              setStreamMessages(prev => [...prev, data]);
              
              // Update status based on message type
              if (data.type === 'complete') {
                setAnalysis(data.analysis);
                setAnalysisStatus('complete');
                setIsAnalyzing(false);
                if (onAnalysisComplete) {
                  onAnalysisComplete(video.id, data.analysis);
                }
                toast.success('Analysis complete!');
              } else if (data.type === 'failed') {
                setAnalysis(data.message);
                setAnalysisStatus('failed');
                setIsAnalyzing(false);
                toast.error('Analysis failed');
              } else if (data.type === 'timeout') {
                setAnalysisStatus('timeout');
                setIsAnalyzing(false);
                toast.error('Analysis timed out');
              } else if (data.type === 'error') {
                setAnalysisStatus('error');
                setIsAnalyzing(false);
                toast.error(`Error: ${data.message}`);
              } else if (data.type === 'progress') {
                setAnalysisStatus('in-progress');
              }
            } catch (e) {
              console.error('Error parsing SSE message:', e);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error starting analysis stream:', error);
      setAnalysisStatus('error');
      setIsAnalyzing(false);
      toast.error(`Error: ${error.message || 'Failed to analyze video'}`);
    }
  };

  // Analyze the video
  const analyzeVideo = async () => {
    try {
      setIsAnalyzing(true);
      setAnalysisStatus('starting');
      
      // First, start the analysis process
      const response = await fetch('/api/tiktok-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          videoId: video.id
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start analysis');
      }
      
      // Then start streaming the results
      startStreamingAnalysis();
    } catch (error: any) {
      console.error('Error analyzing video:', error);
      setAnalysisStatus('error');
      setIsAnalyzing(false);
      toast.error(`Error: ${error.message || 'Failed to analyze video'}`);
    }
  };

  // Render analysis status
  const renderAnalysisStatus = () => {
    if (isAnalysisComplete && !isAnalysisFailed) {
      return (
        <div className="flex items-center space-x-2 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span>Analysis complete</span>
        </div>
      );
    } else if (isAnalysisFailed) {
      return (
        <div className="flex items-center space-x-2 text-red-600">
          <XCircle className="h-4 w-4" />
          <span>Analysis failed</span>
        </div>
      );
    } else if (isAnalyzing) {
      return (
        <div className="flex items-center space-x-2 text-blue-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Analyzing video... {streamMessages.length > 0 ? `(${streamMessages.length} updates)` : ''}</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center space-x-2 text-gray-600">
          <Info className="h-4 w-4" />
          <span>Not analyzed yet</span>
        </div>
      );
    }
  };

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg truncate">{video.title || 'Untitled Video'}</CardTitle>
            <CardDescription>By {video.author || 'Unknown'}</CardDescription>
          </div>
          <Badge variant={isAnalysisComplete ? 'default' : 'outline'}>
            {isAnalysisComplete ? 'Analyzed' : 'Not Analyzed'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative aspect-video bg-gray-100">
          {video.thumbnail_url ? (
            <>
              <video
                ref={videoRef}
                src={video.download_url || video.video_url}
                poster={video.thumbnail_url}
                className="w-full h-full object-cover"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                controls={false}
              />
              <button
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 hover:bg-opacity-30 transition-all"
              >
                {isPlaying ? (
                  <Pause className="h-12 w-12 text-white" />
                ) : (
                  <Play className="h-12 w-12 text-white" />
                )}
              </button>
            </>
          ) : (
            <Skeleton className="w-full h-full" />
          )}
        </div>
        
        <div className="p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">Analysis</h3>
            {renderAnalysisStatus()}
          </div>
          
          {isAnalysisComplete && !isAnalysisFailed ? (
            <div className="text-sm mt-2 max-h-40 overflow-y-auto">
              {analysis}
            </div>
          ) : isAnalysisFailed ? (
            <div className="text-sm mt-2 text-red-600">
              {analysis}
            </div>
          ) : (
            <div className="text-sm mt-2 text-gray-500">
              {isAnalyzing ? (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Analysis in progress...</span>
                  </div>
                  {streamMessages.length > 0 && (
                    <div className="text-xs text-gray-500 max-h-20 overflow-y-auto">
                      {streamMessages.map((msg, i) => (
                        <div key={i} className="mb-1">
                          {msg.type === 'progress' ? (
                            <span>Still analyzing... (attempt {msg.attempts})</span>
                          ) : (
                            <span>{msg.message}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <span>Click "Analyze" to analyze this video</span>
              )}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(video.video_url, '_blank')}
        >
          View Original
        </Button>
        <Button
          variant={isAnalysisComplete ? "outline" : "default"}
          size="sm"
          onClick={analyzeVideo}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : isAnalysisComplete ? (
            'Re-Analyze'
          ) : (
            'Analyze'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
