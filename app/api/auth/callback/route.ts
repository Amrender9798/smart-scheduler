import { google } from 'googleapis'
import { NextRequest, NextResponse } from 'next/server'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3000/api/auth/callback'
)

// Step 2: Google redirects here with a code, we exchange it for tokens
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 })
  }

  const { tokens } = await oauth2Client.getToken(code)

  // This will print your refresh token in the browser
  return NextResponse.json({
    message: 'Copy the refresh_token below into your .env.local',
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token
  })
}