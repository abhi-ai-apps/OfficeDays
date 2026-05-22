export interface UserSettings {
  targetPct: number
  keyword: string
  country: string
  locationText: string
  lat: number | null
  lon: number | null
}

export interface CalendarEvent {
  date: string
  title: string
}

export interface Holiday {
  date: string
  localName: string
}

export interface WeatherDay {
  date: string
  tempMax: number
  precipProbability: number
  weatherCode: number
}

export interface AttendanceStats {
  workingDays: string[]
  attended: string[]
  attendedCount: number
  attendancePct: number
  targetCount: number
  stillNeeded: number
  remaining: string[]
}

export interface Recommendation {
  date: string
  score: number
  tempMax: number
  precipProbability: number
  weatherCode: number
}
