import { useState, useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import './App.css'

const QUICK_WEEKS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
]

function formatDate(date) {
  const jour = JOURS[date.getDay()]
  const num = date.getDate()
  const mois = MOIS[date.getMonth()]
  const annee = date.getFullYear()
  return `${jour} ${num} ${mois} ${annee}`
}

function formatShortDate(date) {
  const num = date.getDate()
  const mois = MOIS[date.getMonth()]
  return `${num} ${mois}`
}

function addWeeks(date, weeks) {
  const result = new Date(date)
  result.setDate(result.getDate() + weeks * 7)
  return result
}

function toDateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function loadVacations() {
  try {
    const raw = localStorage.getItem('vacations')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function findVacationConflict(date, vacations) {
  if (!date) return null
  const t = date.getTime()
  for (const v of vacations) {
    const start = new Date(v.start + 'T00:00:00')
    const end = new Date(v.end + 'T23:59:59')
    if (t >= start.getTime() && t <= end.getTime()) return v
  }
  return null
}

export default function App() {
  const today = new Date()
  const [selectedWeeks, setSelectedWeeks] = useState(null)
  const [customWeeks, setCustomWeeks] = useState('')
  const [copied, setCopied] = useState(false)
  const [vacations, setVacations] = useState(loadVacations)
  const [vacStart, setVacStart] = useState('')
  const [vacEnd, setVacEnd] = useState('')
  const [showVacations, setShowVacations] = useState(false)

  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  useEffect(() => {
    localStorage.setItem('vacations', JSON.stringify(vacations))
  }, [vacations])

  const weeks = selectedWeeks !== null
    ? selectedWeeks
    : customWeeks !== '' ? parseInt(customWeeks) : null

  const resultDate = weeks !== null && !isNaN(weeks) && weeks > 0
    ? addWeeks(today, weeks)
    : null

  const resultText = resultDate ? formatDate(resultDate) : null
  const conflict = findVacationConflict(resultDate, vacations)

  function handleQuickSelect(w) {
    setSelectedWeeks(w)
    setCustomWeeks('')
    setCopied(false)
  }

  function handleCustom(e) {
    setCustomWeeks(e.target.value)
    setSelectedWeeks(null)
    setCopied(false)
  }

  function handleCopy() {
    if (!resultText) return
    navigator.clipboard.writeText(resultText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleReset() {
    setSelectedWeeks(null)
    setCustomWeeks('')
    setCopied(false)
  }

  function handleAddVacation() {
    if (!vacStart || !vacEnd || vacEnd < vacStart) return
    setVacations(prev => [...prev, { start: vacStart, end: vacEnd }])
    setVacStart('')
    setVacEnd('')
  }

  function handleRemoveVacation(index) {
    setVacations(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="app">
      {needRefresh && (
        <div className="update-banner">
          <span>Mise à jour disponible</span>
          <button onClick={() => updateServiceWorker(true)}>Actualiser</button>
        </div>
      )}

      <div className="header">
        <p className="greeting">Bonjour, Dr. Rumen</p>
        <p className="date-label">Nous sommes le</p>
        <h1 className="today">{formatDate(today)}</h1>
      </div>

      <div className="divider" />

      <div className="section">
        <p className="section-label">Délai entre les injections</p>
        <div className="quick-grid">
          {QUICK_WEEKS.map(w => (
            <button
              key={w}
              className={`quick-btn${selectedWeeks === w ? ' active' : ''}`}
              onClick={() => handleQuickSelect(w)}
            >
              <span className="week-num">{w}</span>
              <span className="week-unit">sem.</span>
            </button>
          ))}
        </div>

        <div className="custom-row">
          <input
            type="number"
            className="custom-input"
            placeholder="Nombre de semaines personnalisé"
            min="1"
            max="52"
            value={customWeeks}
            onChange={handleCustom}
          />
        </div>
      </div>

      {resultDate && (
        <>
          <div className={`result-card${conflict ? ' conflict' : ''}`} onClick={handleCopy}>
            <p className="result-eyebrow">Prochaine injection · {weeks} semaine{weeks > 1 ? 's' : ''}</p>
            <p className="result-date">{resultText}</p>
            {conflict && (
              <p className="conflict-warning">
                ⚠ Tombe pendant vos vacances ({formatShortDate(new Date(conflict.start + 'T00:00:00'))} – {formatShortDate(new Date(conflict.end + 'T00:00:00'))})
              </p>
            )}
            <div className={`copy-pill${copied ? ' copied' : ''}`}>
              {copied ? '✓ Copié' : 'Copier la date'}
            </div>
          </div>

          <button className="reset-btn" onClick={handleReset}>
            Nouveau calcul
          </button>
        </>
      )}

      <div className="divider" style={{ marginTop: 28 }} />

      <div className="section">
        <button className="vacation-toggle" onClick={() => setShowVacations(v => !v)}>
          <span className="section-label" style={{ margin: 0 }}>
            Mes vacances{vacations.length > 0 ? ` (${vacations.length})` : ''}
          </span>
          <span className={`chevron${showVacations ? ' open' : ''}`}>›</span>
        </button>

        {showVacations && (
          <div className="vacation-section">
            <div className="vacation-form">
              <div className="vacation-dates">
                <div className="vacation-field">
                  <label className="vacation-label">Début</label>
                  <input
                    type="date"
                    className="vacation-input"
                    value={vacStart}
                    min={toDateString(today)}
                    onChange={e => setVacStart(e.target.value)}
                  />
                </div>
                <div className="vacation-field">
                  <label className="vacation-label">Fin</label>
                  <input
                    type="date"
                    className="vacation-input"
                    value={vacEnd}
                    min={vacStart || toDateString(today)}
                    onChange={e => setVacEnd(e.target.value)}
                  />
                </div>
              </div>
              <button
                className="vacation-add-btn"
                onClick={handleAddVacation}
                disabled={!vacStart || !vacEnd || vacEnd < vacStart}
              >
                Ajouter
              </button>
            </div>

            {vacations.length > 0 && (
              <div className="vacation-list">
                {vacations.map((v, i) => (
                  <div key={i} className="vacation-item">
                    <span className="vacation-range">
                      {formatShortDate(new Date(v.start + 'T00:00:00'))} – {formatShortDate(new Date(v.end + 'T00:00:00'))}
                    </span>
                    <button className="vacation-remove" onClick={() => handleRemoveVacation(i)}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {vacations.length === 0 && (
              <p className="vacation-empty">Aucune période de vacances enregistrée</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
