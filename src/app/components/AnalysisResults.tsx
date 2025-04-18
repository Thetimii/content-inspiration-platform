import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import styles from '../styles/AnalysisResults.module.css'
import { useRouter } from 'next/navigation'
import { Button } from './Button'
import { ErrorMessage } from './ErrorMessage'
import { Spinner } from './Spinner'

// Helper to get the base URL
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // Client-side
    return window.location.origin;
  }
  // Server-side
  return process.env.VERCEL_URL ? 
    `https://${process.env.VERCEL_URL}` : 
    'http://localhost:3000';
};

interface AnalysisResultsProps {
  searchQuery: string
  analysis: any
  isLoading: boolean
  error: string | null
  onNew: () => void
}

export const AnalysisResults = ({
  searchQuery,
  analysis,
  isLoading,
  error,
  onNew,
}: AnalysisResultsProps) => {
  const router = useRouter()
  const [copySuccess, setCopySuccess] = useState('')
  const [patternLoading, setPatternLoading] = useState(false)
  const [patternAnalysis, setPatternAnalysis] = useState<string | null>(null)
  const [patternError, setPatternError] = useState<string | null>(null)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(
        patternAnalysis || JSON.stringify(analysis, null, 2)
      )
      setCopySuccess('Copied!')
      setTimeout(() => setCopySuccess(''), 2000)
    } catch (err) {
      setCopySuccess('Failed to copy')
      setTimeout(() => setCopySuccess(''), 2000)
    }
  }

  const handlePatternAnalysis = async () => {
    if (!analysis) return

    setPatternLoading(true)
    setPatternError(null)
    
    try {
      // Call the server API for pattern analysis
      const baseUrl = getBaseUrl();
      console.log(`Calling pattern analysis API at ${baseUrl}/api/analyze-patterns`);
      
      const response = await fetch(`${baseUrl}/api/analyze-patterns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoAnalyses: Array.isArray(analysis) ? analysis : [analysis],
          userId: localStorage.getItem('userId') || 'anonymous',
        }),
      });

      if (!response.ok) {
        console.error(`Pattern analysis API error: ${response.status}`);
        throw new Error(`Server error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Pattern analysis API response:', data);
      
      if (!data.success) {
        throw new Error(data.error || 'Pattern analysis failed');
      }
      
      // Save the pattern analysis
      setPatternAnalysis(data.result.pattern_analysis);
      
    } catch (err) {
      console.error('Pattern analysis error:', err);
      setPatternError(err instanceof Error ? err.message : 'Failed to analyze patterns');
      
      // Fall back to local pattern generation
      generateLocalPattern();
    } finally {
      setPatternLoading(false);
    }
  }
  
  // Separate function for local pattern generation as fallback
  const generateLocalPattern = () => {
    try {
      console.log('Generating pattern analysis locally as fallback');
      
      const analysisItems = Array.isArray(analysis) ? analysis : [analysis];
      const searchQueries = analysisItems
        .map(item => item.search_query || 'unknown')
        .filter(Boolean);
      const uniqueQueries = Array.from(new Set(searchQueries));
      
      const patternText = `
# CONTENT PATTERN ANALYSIS (Local Fallback)

## CONTENT OVERVIEW
- Analysis based on ${analysisItems.length} videos from searches: ${uniqueQueries.join(', ')}
- Common themes include educational content, tutorials, and demonstrations
- Content is primarily instructional with a focus on sharing expertise
- Videos typically have clear introductions and conclusions
- Most videos include calls to action to engage with the content

## TECHNICAL REQUIREMENTS
- Clear, well-lit recording environment
- Stable camera setup, preferably on a tripod
- Good quality audio recording
- Simple, uncluttered backgrounds
- Natural lighting or softbox lighting for even illumination

## RECREATION GUIDE
- Plan your content with a clear beginning, middle, and end
- Start with a hook to grab attention in the first few seconds
- Present your main points clearly and concisely
- Use simple language and avoid technical jargon
- End with a clear call to action

## OPTIMIZATION TIPS
- Post consistently to build audience
- Use relevant hashtags based on your content and industry
- Respond to comments to build engagement
- Analyze your best-performing content and create more similar material
- Cross-promote your content on other platforms
`;
      
      setPatternAnalysis(patternText);
    } catch (fallbackError) {
      console.error('Error in local fallback generation:', fallbackError);
    }
  }

  useEffect(() => {
    // Reset pattern analysis when new analysis comes in
    setPatternAnalysis(null)
    setPatternError(null)
  }, [analysis])

  // Log the analysis data for debugging
  useEffect(() => {
    console.log('Current analysis data:', analysis);
  }, [analysis]);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <Spinner size="large" />
        <p>Analyzing content for "{searchQuery}"...</p>
        <p className={styles.loadingNote}>This may take up to a minute</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <ErrorMessage message={`Analysis failed: ${error}`} />
        <p>We encountered an issue while analyzing this content.</p>
        <Button onClick={onNew} variant="primary">
          Try Another Search
        </Button>
      </div>
    )
  }

  // Check if analysis is missing or incomplete
  const isAnalysisValid = analysis && 
    (Array.isArray(analysis) ? analysis.length > 0 : Object.keys(analysis).length > 0);

  if (!isAnalysisValid) {
    return (
      <div className={styles.errorContainer}>
        <ErrorMessage message="No analysis results available" />
        <p>We couldn't generate an analysis for this search query. Please try a different query.</p>
        <Button onClick={onNew} variant="primary">
          Try Another Search
        </Button>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>
        Analysis Results for &quot;{searchQuery}&quot;
      </h2>

      <div className={styles.controls}>
        <Button onClick={onNew} variant="secondary">
          New Analysis
        </Button>
        <Button onClick={copyToClipboard} variant="secondary">
          {copySuccess || 'Copy Results'}
        </Button>
        {!patternAnalysis && !patternLoading && (
          <Button onClick={handlePatternAnalysis} variant="primary">
            Generate Pattern Analysis
          </Button>
        )}
      </div>

      {patternLoading && (
        <div className={styles.patternLoading}>
          <Spinner size="medium" />
          <p>Generating pattern analysis...</p>
        </div>
      )}

      {patternError && (
        <div className={styles.patternError}>
          <ErrorMessage message={patternError} />
          <p>We encountered an issue while generating the pattern analysis, but your original analysis is still available below.</p>
        </div>
      )}

      {patternAnalysis ? (
        <div className={styles.patternAnalysis}>
          <h3>Pattern Analysis</h3>
          <div className={styles.markdownContainer}>
            <ReactMarkdown>{patternAnalysis}</ReactMarkdown>
          </div>
        </div>
      ) : (
        <div className={styles.resultData}>
          {Array.isArray(analysis) ? (
            analysis.map((item, index) => (
              <div key={index} className={styles.analysisItem}>
                <h3>
                  {item.title ? 
                    `Video ${index + 1}: ${item.title.substring(0, 50)}${item.title.length > 50 ? '...' : ''}` : 
                    `Video ${index + 1}`
                  }
                </h3>
                {item.analysis ? (
                  <div className={styles.markdownContainer}>
                    <ReactMarkdown>{item.analysis}</ReactMarkdown>
                  </div>
                ) : (
                  <pre>{JSON.stringify(item, null, 2)}</pre>
                )}
              </div>
            ))
          ) : (
            typeof analysis === 'object' && analysis !== null && analysis.analysis ? (
              <div className={styles.markdownContainer}>
                <h3>{analysis.title || "Video Analysis"}</h3>
                <ReactMarkdown>{analysis.analysis}</ReactMarkdown>
              </div>
            ) : (
              <div className={styles.errorContainer}>
                <ErrorMessage message="Invalid analysis format" />
                <pre className={styles.jsonDebug}>{JSON.stringify(analysis, null, 2)}</pre>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
} 