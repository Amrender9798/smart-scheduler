import { google } from 'googleapis'

// Setup OAuth client with your credentials
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3000/api/auth/callback'
)

// Set the refresh token — this auto-refreshes access when needed
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
})

const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

// Fetch all events in a time range
export async function getEvents(startTime: Date, endTime: Date) {
  const response = await calendar.events.list({
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    timeMin: startTime.toISOString(),
    timeMax: endTime.toISOString(),
    singleEvents: true,
    orderBy: 'startTime'
  })

  return response.data.items || []
}

// Find available slots given a duration (in minutes)
export async function getAvailableSlots(
  date: Date,
  durationMinutes: number
): Promise<{ start: Date; end: Date }[]> {

  // Define working hours: 9am to 6pm
  const dayStart = new Date(date)
  dayStart.setHours(9, 0, 0, 0)

  const dayEnd = new Date(date)
  dayEnd.setHours(18, 0, 0, 0)

  // Get all existing events for that day
  const events = await getEvents(dayStart, dayEnd)

  // Build list of busy time blocks
  const busySlots = events.map(event => ({
    start: new Date(event.start?.dateTime || event.start?.date || ''),
    end: new Date(event.end?.dateTime || event.end?.date || '')
  }))

  // Walk through the day in chunks and find free slots
  const availableSlots: { start: Date; end: Date }[] = []
  let current = new Date(dayStart)

  while (current < dayEnd) {
    const slotEnd = new Date(current.getTime() + durationMinutes * 60 * 1000)

    // Don't go past working hours
    if (slotEnd > dayEnd) break

    // Check if this slot overlaps with any busy slot
    const isOverlapping = busySlots.some(busy =>
      current < busy.end && slotEnd > busy.start
    )

    if (!isOverlapping) {
      availableSlots.push({ start: new Date(current), end: new Date(slotEnd) })
    }

    // Move 30 minutes forward
    current = new Date(current.getTime() + 30 * 60 * 1000)
  }

  return availableSlots
}

// Create an event on the calendar
export async function bookMeeting(
  title: string,
  start: Date,
  end: Date,
  description?: string
) {
  const response = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    requestBody: {
      summary: title,
      description: description || '',
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() }
    }
  })

  return response.data
}