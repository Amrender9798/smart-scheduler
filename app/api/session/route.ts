import { NextRequest, NextResponse } from "next/server";

const sessionConfig = JSON.stringify({
  type: "realtime",
  model: "gpt-realtime-2",
  audio: { output: { voice: "marin" } },
  instructions: "You are a helpful scheduling assistant named Smart Scheduler.",
  tools: [
    {
      type: "function",
      name: "get_current_time",
      description: "Returns the current time to anchor calendar offsets.",
      parameters: { type: "object", properties: {}, required: [] }
    },
    {
      type: "function",
      name: "check_calendar_availability",
      description: "Checks the calendar for free/busy times in a given window.",
      parameters: {
        type: "object",
        properties: {
          time_min: { type: "string", description: "ISO 8601 string for start time" },
          time_max: { type: "string", description: "ISO 8601 string for end time" }
        },
        required: ["time_min", "time_max"]
      }
    },
    {
      type: "function",
      name: "schedule_meeting",
      description: "Schedules a meeting on the calendar.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Title of the meeting" },
          start_time: { type: "string", description: "ISO 8601 start time" },
          end_time: { type: "string", description: "ISO 8601 end time" }
        },
        required: ["summary", "start_time", "end_time"]
      }
    }
  ],
});

export async function POST(req: NextRequest) {
  const body = await req.text();
  if (!body) {
    return new NextResponse("Missing SDP offer body from client.", { status: 400 });
  }

  const fd = new FormData();
  fd.set("sdp", body);
  fd.set("session", sessionConfig);

  try {
    const r = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Safety-Identifier": "hashed-user-id",
      },
      body: fd,
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error("OpenAI rejected the WebRTC handshake:", errText);
      return new NextResponse(errText, { status: r.status });
    }

    const sdp = await r.text();
    return new NextResponse(sdp);
  } catch (error) {
    console.error("Token generation error:", error);
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 });
  }
}