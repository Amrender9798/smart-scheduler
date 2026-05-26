import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

function getCalendarClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return google.calendar({ version: 'v3', auth })
}

export async function POST(req: NextRequest) {
  const { function: fn, args } = await req.json()
  const calendar = getCalendarClient()
  try {
    if (fn === 'check_calendar_availability') {
      const res = await calendar.freebusy.query({
        requestBody: {
          timeMin: args.time_min,
          timeMax: args.time_max,
          timeZone: 'UTC',
          items: [{ id: 'primary' }]
        }
      })
      const busy = res.data.calendars?.primary?.busy || []
      return NextResponse.json({ available: busy.length === 0, busy })
    }

    if (fn === 'schedule_meeting') {
      const res = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: args.summary,
          start: { dateTime: args.start_time, timeZone: 'UTC' },
          end: { dateTime: args.end_time, timeZone: 'UTC' }
        }
      })
      return NextResponse.json({
        status: 'success',
        eventId: res.data.id,
        link: res.data.htmlLink,
        summary: args.summary,
        start: args.start_time,
        end: args.end_time
      })
    }

    if (fn === 'find_reference_event') {
      const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults: 5,
        singleEvents: true,
        orderBy: 'startTime',
        q: args.query
      })
      const events = res.data.items || []
      if (events.length === 0) return NextResponse.json({ found: false })
      const event = events[0]
      return NextResponse.json({
        found: true,
        event: {
          summary: event.summary,
          start: event.start?.dateTime || event.start?.date,
          end: event.end?.dateTime || event.end?.date
        }
      })
    }

    return NextResponse.json({ error: 'Unknown function' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Calendar error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}