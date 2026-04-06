import { useState, useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import './App.css'

/* ── Constantes ──────────────────────────────── */

const QUICK_WEEKS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
]

const IOL_PRESETS = [
  { name: 'AcrySof IQ SN60WF', a: 118.7 },
  { name: 'AcrySof IQ Toric', a: 118.7 },
  { name: 'PanOptix TFNT00', a: 119.1 },
  { name: 'Tecnis ZCB00', a: 119.3 },
  { name: 'Tecnis Symfony', a: 119.3 },
  { name: 'enVista MX60', a: 118.7 },
  { name: 'CT Lucia 621P', a: 118.3 },
  { name: 'Vivinex XY1', a: 119.0 },
]

/* ── Utilitaires ─────────────────────────────── */

function formatDate(date) {
  return `${JOURS[date.getDay()]} ${date.getDate()} ${MOIS[date.getMonth()]} ${date.getFullYear()}`
}

function formatShortDate(date) {
  return `${date.getDate()} ${MOIS[date.getMonth()]}`
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
  } catch { return [] }
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

/* ── Formule SRK/T ───────────────────────────── */

function calculateSRKT(AL, K, Aconst, targetRef) {
  const na = 1.336
  const nc2 = 0.333
  const V = 12.0

  const r = 337.5 / K

  // Longueur axiale corrigée (yeux longs)
  let Lcor = AL
  if (AL > 24.2) {
    Lcor = -3.446 + 1.716 * AL - 0.0237 * AL * AL
  }

  // Largeur cornéenne
  const Cw = -5.40948 + 0.58412 * Lcor + 0.098 * K
  // Hauteur cornéenne
  const H = r - Math.sqrt(r * r - Cw * Cw / 4)

  // Profondeur de chambre antérieure estimée
  const ACDconst = 0.62467 * Aconst - 68.74709
  const ACD = H + ACDconst - 3.3357

  // Épaisseur rétinienne & longueur axiale optique
  const Lopt = AL + 0.65696 - 0.02029 * AL

  // Puissance IOL pour emmétropie
  const num = 1000 * na * (na * r - nc2 * Lopt)
  const den = (Lopt - ACD) * (na * r - nc2 * ACD)
  const IOLemme = num / den

  if (targetRef === 0) return IOLemme

  // Ajustement pour réfraction cible
  const CR = targetRef / (1 - V / 1000 * targetRef)
  const factor = 1000 * na / ((Lopt - ACD) * (Lopt - ACD)) *
    (na * r - nc2 * ACD) / ((na * r - nc2 * ACD) * (na * r - nc2 * ACD)) *
    (Lopt - ACD)
  // Approximation standard : ~1.0/(1 - 0.012*K) par dioptrie
  const refFactor = 1.0 / (1.0 - 0.001 * V * (IOLemme / 1000 + 1 / (na / nc2)))

  return IOLemme - CR * Math.abs(refFactor > 0.5 ? refFactor : 1.4)
}

/* ── App ─────────────────────────────────────── */

export default function App() {
  const today = new Date()
  const [activeTab, setActiveTab] = useState('injection')

  // Injection state
  const [injectionCount, setInjectionCount] = useState(null)
  const [weeksList, setWeeksList] = useState([])
  const [step, setStep] = useState(0) // 0 = count, 1..N = weeks, N+1 = result
  const [copied, setCopied] = useState(false)
  const [vacations, setVacations] = useState(loadVacations)
  const [vacStart, setVacStart] = useState('')
  const [vacEnd, setVacEnd] = useState('')
  const [showVacations, setShowVacations] = useState(false)

  // IOL state
  const [iolAL, setIolAL] = useState('')
  const [iolK1, setIolK1] = useState('')
  const [iolK2, setIolK2] = useState('')
  const [iolAconst, setIolAconst] = useState('118.7')
  const [iolTarget, setIolTarget] = useState('0')
  const [iolPreset, setIolPreset] = useState('')
  const [iolCopied, setIolCopied] = useState(false)

  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  useEffect(() => {
    localStorage.setItem('vacations', JSON.stringify(vacations))
  }, [vacations])

  // Injection logic
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

  // IOL logic
  const al = parseFloat(iolAL)
  const k1 = parseFloat(iolK1)
  const k2 = parseFloat(iolK2)
  const aConst = parseFloat(iolAconst)
  const target = parseFloat(iolTarget) || 0
  const kMean = (k1 + k2) / 2

  const iolValid = al >= 18 && al <= 36 && k1 >= 35 && k1 <= 55 && k2 >= 35 && k2 <= 55 && aConst >= 100 && aConst <= 130
  const iolPower = iolValid ? calculateSRKT(al, kMean, aConst, target) : null

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
    // Auto-advance
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

  function handlePreset(e) {
    const name = e.target.value
    setIolPreset(name)
    const preset = IOL_PRESETS.find(p => p.name === name)
    if (preset) setIolAconst(String(preset.a))
  }

  function handleCopyIOL() {
    if (iolPower === null) return
    const text = `IOL: ${iolPower.toFixed(2)} D (SRK/T) | AL=${al} K=${kMean.toFixed(2)} A=${aConst} Cible=${target}`
    navigator.clipboard.writeText(text).then(() => {
      setIolCopied(true)
      setTimeout(() => setIolCopied(false), 2000)
    })
  }

  function handleResetIOL() {
    setIolAL('')
    setIolK1('')
    setIolK2('')
    setIolAconst('118.7')
    setIolTarget('0')
    setIolPreset('')
    setIolCopied(false)
  }

  /* ── Render ────────────────────────────────── */

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

      {/* ── Tab: Injections ──────────────────── */}
      {activeTab === 'injection' && (
        <>
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
                const suffix = (n) => n === 1 ? 'ʳᵉ' : 'ᵉ'
                return (
                  <div className="section wizard-step" key={idx}>
                    <p className="wizard-question">
                      {idx === 0
                        ? <>Délai avant la <strong>1ʳᵉ injection</strong> ?</>
                        : <>Délai entre la <strong>{idx}{suffix(idx)}</strong> et la <strong>{idx + 1}{suffix(idx + 1)} injection</strong> ?</>}
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
      )}

      {/* ── Tab: Implants ────────────────────── */}
      {activeTab === 'implant' && (
        <>
          <div className="section">
            <p className="section-label">Calculateur d'implant · SRK/T</p>

            <div className="iol-form">
              <div className="iol-field">
                <label className="iol-label">Longueur axiale (mm)</label>
                <input
                  type="number"
                  className="iol-input"
                  placeholder="ex: 23.50"
                  step="0.01"
                  min="18"
                  max="36"
                  value={iolAL}
                  onChange={e => setIolAL(e.target.value)}
                />
              </div>

              <div className="iol-row">
                <div className="iol-field">
                  <label className="iol-label">K1 (D)</label>
                  <input
                    type="number"
                    className="iol-input"
                    placeholder="ex: 43.50"
                    step="0.01"
                    min="35"
                    max="55"
                    value={iolK1}
                    onChange={e => setIolK1(e.target.value)}
                  />
                </div>
                <div className="iol-field">
                  <label className="iol-label">K2 (D)</label>
                  <input
                    type="number"
                    className="iol-input"
                    placeholder="ex: 44.00"
                    step="0.01"
                    min="35"
                    max="55"
                    value={iolK2}
                    onChange={e => setIolK2(e.target.value)}
                  />
                </div>
              </div>

              <div className="iol-field">
                <label className="iol-label">Implant (preset)</label>
                <select className="iol-select" value={iolPreset} onChange={handlePreset}>
                  <option value="">Choisir un implant...</option>
                  {IOL_PRESETS.map(p => (
                    <option key={p.name} value={p.name}>{p.name} (A={p.a})</option>
                  ))}
                </select>
              </div>

              <div className="iol-row">
                <div className="iol-field">
                  <label className="iol-label">Constante A</label>
                  <input
                    type="number"
                    className="iol-input"
                    step="0.1"
                    min="100"
                    max="130"
                    value={iolAconst}
                    onChange={e => { setIolAconst(e.target.value); setIolPreset('') }}
                  />
                </div>
                <div className="iol-field">
                  <label className="iol-label">Réfraction cible (D)</label>
                  <input
                    type="number"
                    className="iol-input"
                    placeholder="0"
                    step="0.25"
                    min="-6"
                    max="4"
                    value={iolTarget}
                    onChange={e => setIolTarget(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {iolPower !== null && (
            <>
              <div className="result-card iol-result" onClick={handleCopyIOL}>
                <p className="result-eyebrow">Puissance recommandée · SRK/T</p>
                <p className="result-date">{iolPower.toFixed(2)} D</p>
                <div className="iol-details">
                  <span>AL {al} mm</span>
                  <span>K moy {kMean.toFixed(2)} D</span>
                  <span>A {aConst}</span>
                  {target !== 0 && <span>Cible {target > 0 ? '+' : ''}{target} D</span>}
                </div>
                <div className={`copy-pill${iolCopied ? ' copied' : ''}`}>
                  {iolCopied ? '✓ Copié' : 'Copier le résultat'}
                </div>
              </div>

              <div className="iol-neighbors">
                <p className="iol-neighbors-label">Puissances voisines</p>
                <div className="iol-neighbors-grid">
                  {[-1.0, -0.5, 0, +0.5, +1.0].map(offset => {
                    const p = iolPower + offset
                    return (
                      <div key={offset} className={`iol-neighbor${offset === 0 ? ' current' : ''}`}>
                        <span className="iol-neighbor-power">{p.toFixed(1)}</span>
                        <span className="iol-neighbor-ref">
                          {offset === 0 ? 'choix' : (offset > 0 ? '+' : '') + (offset * -0.7).toFixed(2) + ' D'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <button className="reset-btn" onClick={handleResetIOL}>
                Nouveau calcul
              </button>
            </>
          )}

          <p className="iol-disclaimer">
            Estimation indicative — ne remplace pas la biométrie de référence
          </p>
        </>
      )}

      {/* ── Tab bar ──────────────────────────── */}
      <nav className="tab-bar">
        <button className={`tab${activeTab === 'injection' ? ' active' : ''}`} onClick={() => setActiveTab('injection')}>
          <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22c1-3 6-6 6-12a6 6 0 0 0-12 0c0 6 5 9 6 12Z" />
            <circle cx="12" cy="10" r="1" fill="currentColor" />
          </svg>
          <span>Injections</span>
        </button>
        <button className={`tab${activeTab === 'implant' ? ' active' : ''}`} onClick={() => setActiveTab('implant')}>
          <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="12" cy="12" r="1" fill="currentColor" />
          </svg>
          <span>Implants</span>
        </button>
      </nav>
    </div>
  )
}
