import { NextRequest, NextResponse } from "next/server";
import Groq from 'groq-sdk'
import { getSystemPrompt } from "@/lib/prompts";
import { tools } from "@/lib/tools";
import { getAvailableSlots, bookMeeting, getEvents } from "@/lib/calendar";
import { addDays, parseISO } from "date-fns";

const openai = new Groq({ apiKey: process.env.GROQ_API_KEY })

async function executeTool(toolName: string, args: Record<string, unknown>) {
  if (toolName === "get_available_slots") {
    const date = parseISO(args.date as string);
    const slots = await getAvailableSlots(
      date,
      args.duration_minutes as number,
    );

    if (slots.length === 0) {
      return { available: false, message: "No slots available on this day" };
    }

    // Return max 5 slots to avoid overwhelming the AI
    return {
      available: true,
      slots: slots.slice(0, 5).map((slot) => ({
        start: slot.start.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        end: slot.end.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        date: args.date,
      })),
    };
  }

  if (toolName === "book_meeting") {
    const { title, date, start_time, duration_minutes } = args as {
      title: string;
      date: string;
      start_time: string;
      duration_minutes: number;
    };

    // Build start and end Date objects
    const [hours, minutes] = (start_time as string).split(":").map(Number);
    const start = parseISO(date as string);
    start.setHours(hours, minutes, 0, 0);

    const end = new Date(
      start.getTime() + (duration_minutes as number) * 60 * 1000,
    );

    const event = await bookMeeting(title, start, end);
    return {
      success: true,
      message: `Meeting "${title}" booked on ${date} at ${start_time}`,
      eventId: event.id,
    };
  }

  if (toolName === "get_events") {
    const start = parseISO(args.start_date as string);
    const end = parseISO(args.end_date as string);
    // add 1 day to end to make it inclusive
    const events = await getEvents(start, addDays(end, 1));

    return {
      events: events.map((e) => ({
        title: e.summary,
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
      })),
    };
  }

  return { error: "Unknown tool" };
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    // First call to LLM — may return a tool call or a direct response
    const response = await openai.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{ role: "system", content: getSystemPrompt() }, ...messages],
      tools: tools,
      tool_choice: "auto",
      parallel_tool_calls: false
    });

    const message = response.choices[0].message;

    // If AI wants to call a tool
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0] as {
        id: string;
        function: { name: string; arguments: string };
      };
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);

      // Execute the actual calendar function
      const toolResult = await executeTool(toolName, toolArgs);

      // Send result back to LLM so it can form a natural response
      const finalResponse = await openai.chat.completions.create({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          { role: "system", content: getSystemPrompt() },
          ...messages,
          message, // AI's tool call message
          {
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          },
        ],
        tools: tools,
        parallel_tool_calls: false
      });

      return NextResponse.json({
        reply: finalResponse.choices[0].message.content,
      });
    }

    // No tool call — direct response
    return NextResponse.json({
      reply: message.content,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
