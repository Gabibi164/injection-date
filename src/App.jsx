import { useState, useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { addWeeks, findVacationConflict } from './dateUtils'
import './App.css'

/* ── Constantes ──────────────────────────────── */

const QUICK_WEEKS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
]

/* ── Utilitaires ─────────────────────────────── */

function formatDate(date) {
  return `${JOURS[date.getDay()]} ${date.getDate()} ${MOIS[date.getMonth()]} ${date.getFullYear()}`
}

function formatShortDate(date) {
  return `${date.getDate()} ${MOIS[date.getMonth()]}`
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
  } catch { return [] }
}

/* ── App ─────────────────────────────────────── */

export default function App() {
  const [view, setView] = useState('planning')
  const [now, setNow] = useState(() => new Date())
  const today = now

  // Rafraîchit automatiquement la date courante
  useEffect(() => {
    const tick = () => setNow(new Date())
    const interval = setInterval(tick, 60_000)
    const onVisible = () => { if (!document.hidden) tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const [injectionCount, setInjectionCount] = useState(null)
  const [weeksList, setWeeksList] = useState([])
  const [step, setStep] = useState(0) // 0 = count, 1..N = weeks, N+1 = result
  const [copied, setCopied] = useState(false)
  const [vacations, setVacations] = useState(loadVacations)
  const [vacStart, setVacStart] = useState('')
  const [vacEnd, setVacEnd] = useState('')
  const [showVacations, setShowVacations] = useState(false)

  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  useEffect(() => {
    localStorage.setItem('vacations', JSON.stringify(vacations))
  }, [vacations])

  const count = injectionCount
  const validCount = count !== null && count > 0
  const allWeeksFilled = validCount && weeksList.length === count && weeksList.every(w => w !== null && w > 0)

  const scheduledDates = allWeeksFilled
    ? (() => {
        const dates = []
        let cursor = new Date(today)
        for (let i = 0; i < count; i++) {
          cursor = addWeeks(cursor, weeksList[i])
          dates.push({ date: new Date(cursor), conflict: findVacationConflict(cursor, vacations) })
        }
        return dates
      })()
    : []

  /* ── Handlers ──────────────────────────────── */

  function handleCountSelect(n) {
    setInjectionCount(n)
    setWeeksList(Array(n).fill(null))
    setStep(1)
    setCopied(false)
  }

  function handleSetWeek(index, value) {
    setWeeksList(prev => {
      const next = [...prev]
      next[index] = value
      return next
    })
    setCopied(false)
    setTimeout(() => {
      setStep(s => s + 1)
    }, 200)
  }

  function handleBack() {
    setStep(s => Math.max(0, s - 1))
    setCopied(false)
  }

  function handleCopy() {
    if (!scheduledDates.length) return
    const text = scheduledDates
      .map((s, i) => `Injection ${i + 1} : ${formatDate(s.date)}${s.conflict ? ' ⚠ vacances' : ''}`)
      .join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleReset() {
    setInjectionCount(null)
    setWeeksList([])
    setStep(0)
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

  /* ── Render ────────────────────────────────── */

  return (
    <div className={`app${view === 'amsler' ? ' app-light' : ''}`}>
      {needRefresh && (
        <div className="update-banner">
          <span>Mise à jour disponible</span>
          <button onClick={() => updateServiceWorker(true)}>Actualiser</button>
        </div>
      )}

      {view === 'amsler' ? (
        <AmslerView />
      ) : (
        <PlanningView
          today={today}
          formatDate={formatDate}
          formatShortDate={formatShortDate}
          toDateString={toDateString}
          injectionCount={injectionCount}
          step={step}
          weeksList={weeksList}
          scheduledDates={scheduledDates}
          count={count}
          copied={copied}
          showVacations={showVacations}
          setShowVacations={setShowVacations}
          vacations={vacations}
          vacStart={vacStart}
          vacEnd={vacEnd}
          setVacStart={setVacStart}
          setVacEnd={setVacEnd}
          handleCountSelect={handleCountSelect}
          handleSetWeek={handleSetWeek}
          handleBack={handleBack}
          handleCopy={handleCopy}
          handleReset={handleReset}
          handleAddVacation={handleAddVacation}
          handleRemoveVacation={handleRemoveVacation}
        />
      )}

      <TabBar view={view} setView={setView} />
    </div>
  )
}

/* ── PlanningView ────────────────────────────── */

function PlanningView({
  today, formatDate, formatShortDate, toDateString,
  injectionCount, step, weeksList, scheduledDates, count, copied,
  showVacations, setShowVacations, vacations, vacStart, vacEnd,
  setVacStart, setVacEnd,
  handleCountSelect, handleSetWeek, handleBack, handleCopy, handleReset,
  handleAddVacation, handleRemoveVacation
}) {
  return (
    <>
      <div className="header">
        <p className="greeting">Bonjour, Dr. Rumen</p>
        <p className="date-label">Nous sommes le</p>
        <h1 className="today">{formatDate(today)}</h1>
      </div>

      <div className="divider" />

      {step <= (injectionCount || 0) && (
        <>
          {/* Progress dots */}
          <div className="wizard-progress">
            {Array.from({ length: (injectionCount || 1) + 1 }).map((_, i) => (
              <div key={i} className={`dot${i === step ? ' active' : ''}${i < step ? ' done' : ''}`} />
            ))}
          </div>

          {/* Étape 0 : nombre d'injections */}
          {step === 0 && (
            <div className="section wizard-step">
              <p className="wizard-question">Combien d'injections ?</p>
              <div className="count-grid">
                {[1, 2, 3, 4].map(n => (
                  <button
                    key={n}
                    className={`quick-btn${injectionCount === n ? ' active' : ''}`}
                    onClick={() => handleCountSelect(n)}
                  >
                    <span className="week-num">{n}</span>
                    <span className="week-unit">inj.</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Étapes 1..N : délais */}
          {step >= 1 && step <= (injectionCount || 0) && (() => {
            const idx = step - 1
            const w = weeksList[idx]
            const ordinal = (n) => n === 1
              ? <>1<sup>ère</sup></>
              : <>{n}<sup>e</sup></>
            return (
              <div className="section wizard-step" key={idx}>
                <p className="wizard-question">
                  {idx === 0
                    ? <>Délai avant la <strong>{ordinal(1)} injection</strong> ?</>
                    : <>Délai entre la <strong>{ordinal(idx)}</strong> et la <strong>{ordinal(idx + 1)} injection</strong> ?</>}
                </p>
                <div className="quick-grid">
                  {QUICK_WEEKS.map(weekVal => (
                    <button
                      key={weekVal}
                      className={`quick-btn${w === weekVal ? ' active' : ''}`}
                      onClick={() => handleSetWeek(idx, weekVal)}
                    >
                      <span className="week-num">{weekVal}</span>
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
                    value={w !== null && !QUICK_WEEKS.includes(w) ? w : ''}
                    onChange={e => handleSetWeek(idx, e.target.value === '' ? null : parseInt(e.target.value))}
                  />
                </div>
                <button className="wizard-back" onClick={handleBack}>← Retour</button>
              </div>
            )
          })()}
        </>
      )}

      {step > (injectionCount || 0) && scheduledDates.length > 0 && (
        <>
          <div className="schedule-card">
            <p className="result-eyebrow">
              Planning · {count} injection{count > 1 ? 's' : ''}
            </p>
            <div className="schedule-list">
              {scheduledDates.map((s, i) => (
                <div key={i} className={`schedule-item${s.conflict ? ' conflict' : ''}`}>
                  <span className="schedule-num">{i + 1}</span>
                  <div className="schedule-info">
                    <span className="schedule-date">{formatDate(s.date)}</span>
                    {s.conflict && (
                      <span className="schedule-warning">
                        ⚠ Pendant vos vacances ({formatShortDate(new Date(s.conflict.start + 'T00:00:00'))} – {formatShortDate(new Date(s.conflict.end + 'T00:00:00'))})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button className={`copy-pill${copied ? ' copied' : ''}`} onClick={handleCopy}>
              {copied ? '✓ Copié' : 'Copier toutes les dates'}
            </button>
          </div>

          <button className="reset-btn" onClick={handleReset}>
            Nouveau calcul
          </button>
        </>
      )}

      <div className="vacation-cta-wrapper">
        {!showVacations ? (
          <button className="vacation-cta" onClick={() => setShowVacations(true)}>
            Clique ici pour ajouter tes vacances
            {vacations.length > 0 && <span className="vacation-badge">{vacations.length}</span>}
          </button>
        ) : (
          <div className="vacation-panel">
            <div className="vacation-panel-header">
              <p className="section-label" style={{ margin: 0 }}>Mes vacances</p>
              <button className="vacation-close" onClick={() => setShowVacations(false)}>Fermer</button>
            </div>

            <div className="vacation-form">
              <div className="vacation-dates">
                <div className="vacation-field">
                  <label className="vacation-label">Début</label>
                  <input type="date" className="vacation-input" value={vacStart} min={toDateString(today)} onChange={e => setVacStart(e.target.value)} />
                </div>
                <div className="vacation-field">
                  <label className="vacation-label">Fin</label>
                  <input type="date" className="vacation-input" value={vacEnd} min={vacStart || toDateString(today)} onChange={e => setVacEnd(e.target.value)} />
                </div>
              </div>
              <button className="vacation-add-btn" onClick={handleAddVacation} disabled={!vacStart || !vacEnd || vacEnd < vacStart}>
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
    </>
  )
}

/* ── AmslerView ──────────────────────────────── */

function AmslerView() {
  return (
    <>
      <div className="amsler-header">
        <p className="amsler-eyebrow">Test de dépistage</p>
        <h1 className="amsler-title">Grille d'Amsler</h1>
      </div>

      <div className="amsler-grid-wrap">
        <AmslerGrid />
      </div>
    </>
  )
}

function AmslerGrid() {
  const cells = 20
  const cell = 20
  const total = cells * cell
  const center = total / 2

  const lines = []
  for (let i = 0; i <= cells; i++) {
    const p = i * cell
    lines.push(<line key={`v${i}`} x1={p} y1={0} x2={p} y2={total} />)
    lines.push(<line key={`h${i}`} x1={0} y1={p} x2={total} y2={p} />)
  }

  return (
    <svg
      className="amsler-grid"
      viewBox={`-1 -1 ${total + 2} ${total + 2}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Grille d'Amsler"
    >
      <rect x="0" y="0" width={total} height={total} fill="#fff" />
      <g stroke="#000" strokeWidth="1">{lines}</g>
      <rect x="0" y="0" width={total} height={total} fill="none" stroke="#000" strokeWidth="2" />
      <circle cx={center} cy={center} r="3.5" fill="#000" />
    </svg>
  )
}

/* ── TabBar ──────────────────────────────────── */

function TabBar({ view, setView }) {
  return (
    <nav className="tab-bar">
      <button
        className={`tab${view === 'planning' ? ' active' : ''}`}
        onClick={() => setView('planning')}
      >
        <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        Planning
      </button>
      <button
        className={`tab${view === 'amsler' ? ' active' : ''}`}
        onClick={() => setView('amsler')}
      >
        <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="1" />
          <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
        </svg>
        Amsler
      </button>
    </nav>
  )
}
