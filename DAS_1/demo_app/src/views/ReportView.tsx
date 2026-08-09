import React from 'react'
import './ReportView.css'

interface ReportViewProps {
  report: string | { summary?: string; recommendation?: string }
  onEngage?: () => void
}

export function ReportView({ report, onEngage }: ReportViewProps) {
  // Handles plain string output from AI backend or structured object
  const isStringReport = typeof report === 'string'

  return (
    <div className="report-container">
      <div className="report-card">
        <h1 className="report-title">Screening Report</h1>

        {isStringReport ? (
          <div className="report-section">
            <p className="report-text">{report}</p>
          </div>
        ) : (
          <>
            {report.summary && (
              <div className="report-section">
                <h2 className="report-section-title">Screening Summary</h2>
                <p className="report-text">{report.summary}</p>
              </div>
            )}

            <div className="report-disclaimer-box">
              <p className="report-disclaimer-text">
                <strong>Important note:</strong> This is a brief screening conversation, not a diagnostic assessment. It cannot confirm or rule out dyslexia.
              </p>
            </div>

            {report.recommendation && (
              <div className="report-section report-next-steps-box">
                <h2 className="report-section-title">Recommended Next Step</h2>
                <p className="report-text">{report.recommendation}</p>
              </div>
            )}
          </>
        )}

        {onEngage && (
          <div className="report-action-wrapper">
            <button type="button" className="engage-btn" onClick={onEngage}>
              Engage DAS services
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ReportView