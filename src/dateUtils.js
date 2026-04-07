// Utilitaires de date — fonctions pures testables

export function addWeeks(date, weeks) {
  // Normalise à midi local pour éviter tout glissement DST
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0)
  result.setDate(result.getDate() + weeks * 7)
  return result
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

export function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

export function parseDateString(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

export function findVacationConflict(date, vacations) {
  if (!date) return null
  const dayStart = startOfDay(date).getTime()
  const dayEnd = endOfDay(date).getTime()
  for (const v of vacations) {
    const start = startOfDay(parseDateString(v.start)).getTime()
    const end = endOfDay(parseDateString(v.end)).getTime()
    if (dayStart <= end && dayEnd >= start) return v
  }
  return null
}

export function buildSchedule(startDate, weeksList, vacations = []) {
  const dates = []
  let cursor = startDate
  for (let i = 0; i < weeksList.length; i++) {
    cursor = addWeeks(cursor, weeksList[i])
    dates.push({
      date: new Date(cursor),
      conflict: findVacationConflict(cursor, vacations),
    })
  }
  return dates
}
