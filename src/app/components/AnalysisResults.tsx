import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import styles from '../styles/AnalysisResults.module.css'
import { useRouter } from 'next/navigation'
import { Button } from './Button'
import { ErrorMessage } from './ErrorMessage'
import { Spinner } from './Spinner'

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
      const response = await fetch('/api/analyze-patterns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoAnalyses: Array.isArray(analysis) ? analysis : [analysis],
          userId: localStorage.getItem('userId') || 'anonymous',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to analyze patterns')
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Pattern analysis failed')
      }
      
      setPatternAnalysis(data.result.pattern_analysis)
    } catch (err) {
      console.error('Pattern analysis error:', err)
      setPatternError(err instanceof Error ? err.message : 'Failed to analyze patterns')
    } finally {
      setPatternLoading(false)
    }
  }

  useEffect(() => {
    // Reset pattern analysis when new analysis comes in
    setPatternAnalysis(null)
    setPatternError(null)
  }, [analysis])

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
                <h3>Video {index + 1}</h3>
                <pre>{JSON.stringify(item, null, 2)}</pre>
              </div>
            ))
          ) : (
            <pre>{JSON.stringify(analysis, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  )
} 