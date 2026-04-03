import { useState } from 'react'
import './App.css'

const QUICK_WEEKS = [1, 2, 3, 4, 6, 8, 10, 12, 14, 16]

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

function addWeeks(date, weeks) {
  const result = new Date(date)
  result.setDate(result.getDate() + weeks * 7)
  return result
}

export default function App() {
  const today = new Date()
  const [selectedWeeks, setSelectedWeeks] = useState(null)
  const [customWeeks, setCustomWeeks] = useState('')
  const [copied, setCopied] = useState(false)

  const weeks = selectedWeeks !== null
    ? selectedWeeks
    : customWeeks !== '' ? parseInt(customWeeks) : null

  const resultDate = weeks !== null && !isNaN(weeks) && weeks > 0
    ? addWeeks(today, weeks)
    : null

  const resultText = resultDate ? formatDate(resultDate) : null

  function handleQuickSelect(w) {
    setSelectedWeeks(w)
    setCustomWeeks('')
    setCopied(false)
  }

  function handleCustom(e) {
    const val = e.target.value
    setCustomWeeks(val)
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

  return (
    <div className="app">
      <div className="header">
        <p className="label-today">Aujourd'hui</p>
        <h1 className="today">{formatDate(today)}</h1>
      </div>

      <div className="section">
        <p className="section-label">Délai entre injections</p>
        <div className="quick-grid">
          {QUICK_WEEKS.map(w => (
            <button
              key={w}
              className={`quick-btn${selectedWeeks === w ? ' active' : ''}`}
              onClick={() => handleQuickSelect(w)}
            >
              {w} sem.
            </button>
          ))}
        </div>

        <div className="custom-row">
          <input
            type="number"
            className="custom-input"
            placeholder="Autre nombre de semaines..."
            min="1"
            max="52"
            value={customWeeks}
            onChange={handleCustom}
          />
        </div>
      </div>

      {resultDate && (
        <div className="result-card" onClick={handleCopy}>
          <p className="result-label">Prochaine injection dans {weeks} sem.</p>
          <p className="result-date">{resultText}</p>
          <p className="result-hint">{copied ? '✓ Copié !' : 'Appuyer pour copier'}</p>
        </div>
      )}

      {(selectedWeeks !== null || customWeeks !== '') && (
        <button className="reset-btn" onClick={handleReset}>
          Recommencer
        </button>
      )}
    </div>
  )
}
