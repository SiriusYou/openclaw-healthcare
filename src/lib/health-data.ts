export interface HealthStat {
  readonly title: string
  readonly value: string
  readonly description: string
  readonly icon: "activity" | "heart" | "moon" | "weight"
  readonly trend: string
}

export interface HeartRatePoint {
  readonly time: string
  readonly bpm: number
}

export interface WeightPoint {
  readonly date: string
  readonly kg: number
}

export interface BloodPressurePoint {
  readonly date: string
  readonly systolic: number
  readonly diastolic: number
}

export interface HealthData {
  readonly stats: readonly HealthStat[]
  readonly heartRate: readonly HeartRatePoint[]
  readonly weight: readonly WeightPoint[]
  readonly bloodPressure: readonly BloodPressurePoint[]
}

export const mockHealthData: HealthData = {
  stats: [
    {
      title: "Steps Today",
      value: "8,432",
      description: "Goal: 10,000",
      icon: "activity",
      trend: "+12% from yesterday",
    },
    {
      title: "Heart Rate",
      value: "72 bpm",
      description: "Resting average",
      icon: "heart",
      trend: "Normal range",
    },
    {
      title: "Sleep",
      value: "7h 24m",
      description: "Last night",
      icon: "moon",
      trend: "+30min from average",
    },
    {
      title: "Weight",
      value: "68.5 kg",
      description: "Updated today",
      icon: "weight",
      trend: "-0.3 kg this week",
    },
  ],
  heartRate: [
    { time: "00:00", bpm: 62 },
    { time: "02:00", bpm: 58 },
    { time: "04:00", bpm: 55 },
    { time: "06:00", bpm: 60 },
    { time: "08:00", bpm: 78 },
    { time: "10:00", bpm: 85 },
    { time: "12:00", bpm: 90 },
    { time: "14:00", bpm: 82 },
    { time: "16:00", bpm: 88 },
    { time: "18:00", bpm: 76 },
    { time: "20:00", bpm: 70 },
    { time: "22:00", bpm: 65 },
  ],
  weight: [
    { date: "Mon", kg: 69.2 },
    { date: "Tue", kg: 69.0 },
    { date: "Wed", kg: 68.8 },
    { date: "Thu", kg: 69.1 },
    { date: "Fri", kg: 68.7 },
    { date: "Sat", kg: 68.6 },
    { date: "Sun", kg: 68.5 },
  ],
  bloodPressure: [
    { date: "Mon", systolic: 118, diastolic: 78 },
    { date: "Tue", systolic: 122, diastolic: 82 },
    { date: "Wed", systolic: 115, diastolic: 76 },
    { date: "Thu", systolic: 128, diastolic: 85 },
    { date: "Fri", systolic: 120, diastolic: 80 },
    { date: "Sat", systolic: 125, diastolic: 83 },
    { date: "Sun", systolic: 119, diastolic: 79 },
  ],
}
