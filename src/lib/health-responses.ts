import type { HealthChatSummary } from "./health-data"

const responses: Record<string, (data: HealthChatSummary) => string> = {
  steps: (data) =>
    `You've taken ${data.steps} steps today! That's great progress. To hit your 10,000-step goal, try a short walk after meals — even 10 minutes helps. Consistency matters more than intensity for daily step counts.`,

  walk: (data) =>
    `Walking is one of the best low-impact exercises. With ${data.steps} steps so far today, you're building a solid habit. Aim for a brisk pace (about 100 steps/minute) to maximize cardiovascular benefits.`,

  heart: (data) =>
    `Your resting heart rate is ${data.heartRate}, which falls within the normal adult range of 60-100 bpm. A lower resting heart rate generally indicates better cardiovascular fitness. Regular aerobic exercise can help improve this over time.`,

  sleep: (data) =>
    `You got ${data.sleep} of sleep last night. Adults typically need 7-9 hours. To improve sleep quality, try maintaining a consistent bedtime, limiting screen time 30 minutes before bed, and keeping your room cool and dark.`,

  weight: (data) =>
    `Your current weight is ${data.weight}. Sustainable weight management comes from balanced nutrition and regular activity rather than restrictive diets. Focus on whole foods, adequate protein, and staying hydrated throughout the day.`,

  diet: () =>
    "A balanced diet includes plenty of vegetables, lean proteins, whole grains, and healthy fats. Try to eat at regular intervals and stay hydrated — aim for about 8 glasses of water daily. Small, consistent changes work better than drastic overhauls.",

  exercise: (data) =>
    `With ${data.steps} steps today, you're already staying active! Consider mixing in strength training 2-3 times per week alongside your walking. Even bodyweight exercises like squats, push-ups, and planks can make a big difference.`,

  stress: () =>
    "Managing stress is crucial for overall health. Try deep breathing exercises: inhale for 4 counts, hold for 4, exhale for 4. Regular physical activity, adequate sleep, and mindfulness practices can all help reduce stress levels.",
}

const fallbackResponses = [
  "That's a great health question! While I can provide general wellness tips, I'd recommend consulting your healthcare provider for personalized medical advice. Is there something specific about your steps, sleep, heart rate, or weight I can help with?",
  "I'm here to help with your health journey! I can discuss your daily steps, sleep patterns, heart rate, weight trends, exercise, diet, or stress management. What would you like to know more about?",
  "I'd love to help! Try asking me about your step count, sleep quality, heart rate, weight management, exercise routines, or nutrition tips.",
]

export function getHealthResponse(message: string, data: HealthChatSummary): string {
  const lower = message.toLowerCase()

  for (const [keyword, responseFn] of Object.entries(responses)) {
    if (lower.includes(keyword)) {
      return responseFn(data)
    }
  }

  return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)]
}
