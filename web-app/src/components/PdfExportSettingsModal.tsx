import { PDF_PAPER_SIZE_OPTIONS, type PdfOrientation, type PdfPaperSize } from '../lib/pdfExport'
import { ThemedButton } from '../components/ThemedButton'
import { ButtonLabel } from './ButtonIcon'

type PdfExportSettingsModalProps = {
  title: string
  description: string
  paperSize: PdfPaperSize
  orientation: PdfOrientation
  isExporting: boolean
  onPaperSizeChange: (value: PdfPaperSize) => void
  onOrientationChange: (value: PdfOrientation) => void
  onCancel: () => void
  onConfirm: () => void
}

function PdfExportSettingsModal({
  title,
  description,
  paperSize,
  orientation,
  isExporting,
  onPaperSizeChange,
  onOrientationChange,
  onCancel,
  onConfirm,
}: PdfExportSettingsModalProps) {
  return (
    <div className="terminal-modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="terminal-modal pdf-export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf_export_settings_title"
        onClick={(event) => event.stopPropagation()}
      >
        <article className="panel settings-card">
          <div className="audit-card-header">
            <div>
              <h2 id="pdf_export_settings_title" className="audit-card-title">
                {title}
              </h2>
              <p className="audit-card-description">{description}</p>
            </div>
          </div>

          <div className="pdf-export-options">
            <fieldset className="pdf-export-fieldset">
              <legend>Paper Size</legend>
              <div className="pdf-export-choice-grid">
                {PDF_PAPER_SIZE_OPTIONS.map((option) => {
                  const isSelected = paperSize === option.value

                  return (
                    <label key={option.value} className={`pdf-export-choice${isSelected ? ' is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="pdf_paper_size"
                        value={option.value}
                        checked={isSelected}
                        onChange={() => onPaperSizeChange(option.value)}
                      />
                      <span className="pdf-export-choice__title">{option.label}</span>
                      <span className="pdf-export-choice__meta">{option.sizeInches}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <fieldset className="pdf-export-fieldset">
              <legend>Orientation</legend>
              <div className="pdf-export-choice-grid pdf-export-choice-grid--compact">
                <label className={`pdf-export-choice${orientation === 'portrait' ? ' is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="pdf_orientation"
                    value="portrait"
                    checked={orientation === 'portrait'}
                    onChange={() => onOrientationChange('portrait')}
                  />
                  <span className="pdf-export-choice__title">Portrait</span>
                  <span className="pdf-export-choice__meta">Vertical layout</span>
                </label>
                <label className={`pdf-export-choice${orientation === 'landscape' ? ' is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="pdf_orientation"
                    value="landscape"
                    checked={orientation === 'landscape'}
                    onChange={() => onOrientationChange('landscape')}
                  />
                  <span className="pdf-export-choice__title">Landscape</span>
                  <span className="pdf-export-choice__meta">Horizontal layout</span>
                </label>
              </div>
            </fieldset>
          </div>

          <div className="terminal-modal-actions">
            <button className="topbar-button topbar-button--ghost" type="button" onClick={onCancel} disabled={isExporting}>
              <ButtonLabel icon="cancel">Cancel</ButtonLabel>
            </button>
            <ThemedButton variant="primary" type="button" onClick={onConfirm} disabled={isExporting}>
              <ButtonLabel icon="export">{isExporting ? 'Exporting PDF...' : 'Export PDF'}</ButtonLabel>
            </ThemedButton>
          </div>
        </article>
      </div>
    </div>
  )
}

export default PdfExportSettingsModal
