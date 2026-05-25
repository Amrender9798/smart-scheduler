export const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_available_slots",
      description: "Find available meeting slots on a given date. Call this when you know the date and duration.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Date in YYYY-MM-DD format e.g. 2026-05-26"
          },
          duration_minutes: {
            type: "number",
            description: "Duration in minutes as a number e.g. 30, 60"
          }
        },
        required: ["date", "duration_minutes"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "book_meeting",
      description: "Book a meeting. Only call after user confirms a specific time.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Meeting title" },
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
          start_time: { type: "string", description: "Start time in HH:MM format e.g. 14:00" },
          duration_minutes: { type: "number", description: "Duration in minutes" }
        },
        required: ["title", "date", "start_time", "duration_minutes"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_events",
      description: "Get existing calendar events for a date range.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Start date YYYY-MM-DD" },
          end_date: { type: "string", description: "End date YYYY-MM-DD" }
        },
        required: ["start_date", "end_date"]
      }
    }
  }
]