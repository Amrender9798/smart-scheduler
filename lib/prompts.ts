export function getSystemPrompt() {
  const now = new Date()
  const currentDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  const currentTime = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })

  return `You are a scheduling assistant. Today is ${currentDate}, time is ${currentTime}.

You help users schedule meetings on Google Calendar.

Rules:
- Ask for duration and date before checking calendar
- Use get_available_slots when you know date and duration
- Use book_meeting ONLY after user confirms a time
- Use get_events to check existing meetings
- Keep responses short and conversational
- If no slots available, suggest next day`
}