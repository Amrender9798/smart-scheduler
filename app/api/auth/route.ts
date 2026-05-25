import { google } from 'googleapis'
import { NextResponse } from 'next/server'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3000/api/auth/callback'
)

// Step 1: This redirects you to Google's login page
export async function GET() {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',      // this ensures we get a refresh token
    scope: ['https://www.googleapis.com/auth/calendar'],
    prompt: 'consent'            // forces Google to always return refresh token
  })

  return NextResponse.redirect(url)
}