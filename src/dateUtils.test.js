import { describe, it, expect } from 'vitest'
import { addWeeks, findVacationConflict, parseDateString, buildSchedule } from './dateUtils'

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

describe('addWeeks', () => {
  it('ajoute 4 semaines basique', () => {
    expect(ymd(addWeeks(new Date(2026, 3, 7), 4))).toBe('2026-05-05')
  })

  it('ajoute 1 semaine', () => {
    expect(ymd(addWeeks(new Date(2026, 0, 1), 1))).toBe('2026-01-08')
  })

  it('traverse fin de mois (31 jan + 4 sem)', () => {
    expect(ymd(addWeeks(new Date(2026, 0, 31), 4))).toBe('2026-02-28')
  })

  it('traverse changement d\'année', () => {
    expect(ymd(addWeeks(new Date(2026, 11, 20), 4))).toBe('2027-01-17')
  })

  it('traverse le passage à l\'heure d\'été (29 mars 2026)', () => {
    // 22 mars + 1 semaine doit donner 29 mars (jour du DST) puis 5 avril
    expect(ymd(addWeeks(new Date(2026, 2, 22), 1))).toBe('2026-03-29')
    expect(ymd(addWeeks(new Date(2026, 2, 22), 2))).toBe('2026-04-05')
  })

  it('traverse le passage à l\'heure d\'hiver (25 oct 2026)', () => {
    expect(ymd(addWeeks(new Date(2026, 9, 18), 1))).toBe('2026-10-25')
    expect(ymd(addWeeks(new Date(2026, 9, 18), 2))).toBe('2026-11-01')
  })

  it('année bissextile (29 février 2028)', () => {
    expect(ymd(addWeeks(new Date(2028, 1, 1), 4))).toBe('2028-02-29')
  })

  it('depuis le 29 février année bissextile', () => {
    expect(ymd(addWeeks(new Date(2028, 1, 29), 1))).toBe('2028-03-07')
  })

  it('grand nombre de semaines (52)', () => {
    expect(ymd(addWeeks(new Date(2026, 0, 1), 52))).toBe('2026-12-31')
  })

  it('ne mute pas la date d\'origine', () => {
    const d = new Date(2026, 3, 7)
    addWeeks(d, 4)
    expect(d.getDate()).toBe(7)
    expect(d.getMonth()).toBe(3)
  })
})

describe('parseDateString', () => {
  it('parse YYYY-MM-DD en local', () => {
    const d = parseDateString('2026-04-07')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(3)
    expect(d.getDate()).toBe(7)
    expect(d.getHours()).toBe(0)
  })
})

describe('findVacationConflict', () => {
  const vacs = [
    { start: '2026-07-15', end: '2026-08-02' },
    { start: '2026-12-20', end: '2027-01-05' },
  ]

  it('détecte conflit en plein milieu', () => {
    expect(findVacationConflict(new Date(2026, 6, 20), vacs)).toEqual(vacs[0])
  })

  it('détecte conflit le jour de début (limite incluse)', () => {
    expect(findVacationConflict(new Date(2026, 6, 15), vacs)).toEqual(vacs[0])
  })

  it('détecte conflit le jour de fin (limite incluse)', () => {
    expect(findVacationConflict(new Date(2026, 7, 2), vacs)).toEqual(vacs[0])
  })

  it('pas de conflit la veille du début', () => {
    expect(findVacationConflict(new Date(2026, 6, 14), vacs)).toBeNull()
  })

  it('pas de conflit le lendemain de la fin', () => {
    expect(findVacationConflict(new Date(2026, 7, 3), vacs)).toBeNull()
  })

  it('détecte conflit qui chevauche un changement d\'année', () => {
    expect(findVacationConflict(new Date(2027, 0, 3), vacs)).toEqual(vacs[1])
  })

  it('aucune vacance → null', () => {
    expect(findVacationConflict(new Date(2026, 6, 20), [])).toBeNull()
  })

  it('null si date null', () => {
    expect(findVacationConflict(null, vacs)).toBeNull()
  })
})

describe('buildSchedule', () => {
  it('construit un planning à délais cumulés (4 + 6 + 8 sem)', () => {
    const start = new Date(2026, 3, 7) // 7 avril 2026
    const schedule = buildSchedule(start, [4, 6, 8])
    expect(schedule).toHaveLength(3)
    expect(ymd(schedule[0].date)).toBe('2026-05-05') // +4 sem
    expect(ymd(schedule[1].date)).toBe('2026-06-16') // +6 sem
    expect(ymd(schedule[2].date)).toBe('2026-08-11') // +8 sem
  })

  it('marque les dates en conflit avec les vacances', () => {
    const start = new Date(2026, 6, 1) // 1er juillet 2026
    const vacs = [{ start: '2026-07-15', end: '2026-08-02' }]
    const schedule = buildSchedule(start, [2, 6], vacs)
    expect(schedule[0].conflict).toEqual(vacs[0]) // 15 juillet → conflit
    expect(schedule[1].conflict).toBeNull() // 26 août → ok
  })

  it('planning vide pour weeksList vide', () => {
    expect(buildSchedule(new Date(2026, 3, 7), [])).toEqual([])
  })

  it('cumule correctement même à travers DST', () => {
    const start = new Date(2026, 2, 1) // 1 mars
    const schedule = buildSchedule(start, [4, 4, 4]) // traverse le 29 mars (DST)
    expect(ymd(schedule[0].date)).toBe('2026-03-29')
    expect(ymd(schedule[1].date)).toBe('2026-04-26')
    expect(ymd(schedule[2].date)).toBe('2026-05-24')
  })
})
