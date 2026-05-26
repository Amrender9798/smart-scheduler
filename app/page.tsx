'use client'
import React, { useState, useRef } from 'react'
import { Mic, PhoneOff, Calendar, ExternalLink, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Meeting {
  summary: string
  start: string
  end: string
  link: string
  status: string
  eventId: string
}

export default function Home() {
  const [isConnected, setIsConnected] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState("idle")
  const [meeting, setMeeting] = useState<Meeting | null>(null)

  const peerConnection = useRef<RTCPeerConnection | null>(null)
  const dataChannel = useRef<RTCDataChannel | null>(null)
  const localStream = useRef<MediaStream | null>(null)

  const callCalendarAPI = async (fn: string, args: Record<string, string>) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ function: fn, args })
    })
    return await res.json()
  }

  const connect = async () => {
    if (isBusy || isConnected) return
    setIsBusy(true)
    setConnectionStatus("connecting")
    try {
      const pc = new RTCPeerConnection()
      peerConnection.current = pc

      pc.ontrack = (e) => {
        const audioEl = document.createElement("audio")
        audioEl.autoplay = true
        audioEl.srcObject = e.streams[0]
        document.body.appendChild(audioEl)
      }

      const ms = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStream.current = ms
      pc.addTrack(ms.getTracks()[0], ms)

      const dc = pc.createDataChannel("oai-events")
      dataChannel.current = dc

      dc.onopen = () => {
        setIsConnected(true)
        setIsBusy(false)
        setConnectionStatus("connected")
      }

      dc.onmessage = async (event) => {
        const serverEvent = JSON.parse(event.data)

        if (serverEvent.type === "input_audio_buffer.speech_started") {
          setConnectionStatus("listening")
        }
        if (serverEvent.type === "response.audio_transcript.delta") {
          setConnectionStatus("speaking")
        }
        if (serverEvent.type === "response.done") {
          setConnectionStatus("connected")
        }

        if (serverEvent.type === "response.function_call_arguments.done") {
          const { call_id, name, arguments: argsString } = serverEvent
          const args = JSON.parse(argsString)
          let outputData = null

          if (name === "get_current_time") {
            const now = new Date()
            outputData = {
              current_time: now.toISOString(),
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              local_time: now.toLocaleString('en-IN', {
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
              }),
              utc_offset: -now.getTimezoneOffset() / 60,
              instruction: "User speaks in their local timezone. Convert their requested times to UTC before scheduling."
            }
          } else if (name === "check_calendar_availability") {
            outputData = await callCalendarAPI("check_calendar_availability", {
              time_min: args.time_min,
              time_max: args.time_max
            })
          } else if (name === "schedule_meeting") {
            outputData = await callCalendarAPI("schedule_meeting", {
              summary: args.summary,
              start_time: args.start_time,
              end_time: args.end_time
            })
            setMeeting(outputData)
            setConnectionStatus("booked")
          } else if (name === "find_reference_event") {
            outputData = await callCalendarAPI("find_reference_event", {
              query: args.query
            })
          }

          dc.send(JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id,
              output: JSON.stringify(outputData)
            }
          }))
          dc.send(JSON.stringify({ type: "response.create" }))
        }
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          disconnect()
        }
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: offer.sdp
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(errText)
      }

      const answerSdp = await response.text()
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp })

    } catch (err) {
      console.error("Connection Error:", err)
      setConnectionStatus("error")
      setIsBusy(false)
      disconnect()
    }
  }

  const disconnect = () => {
    dataChannel.current?.close()
    dataChannel.current = null
    peerConnection.current?.close()
    peerConnection.current = null
    localStream.current?.getTracks().forEach(t => t.stop())
    localStream.current = null
    document.querySelectorAll("audio").forEach(el => el.remove())
    setIsConnected(false)
    setIsBusy(false)
    setConnectionStatus("idle")
  }

  const getStatusLabel = () => {
    switch (connectionStatus) {
      case "idle": return "Tap to start scheduling"
      case "connecting": return "Connecting..."
      case "connected": return "Listening — speak now"
      case "listening": return "Hearing you..."
      case "speaking": return "Assistant speaking..."
      case "booked": return "Meeting scheduled!"
      case "error": return "Connection failed — tap to retry"
      default: return ""
    }
  }

  const getStatusColor = () => {
    switch (connectionStatus) {
      case "idle": return "text-zinc-500"
      case "connecting": return "text-yellow-400"
      case "connected": return "text-emerald-400"
      case "listening": return "text-blue-400"
      case "speaking": return "text-purple-400"
      case "booked": return "text-emerald-400"
      case "error": return "text-red-400"
      default: return "text-zinc-500"
    }
  }

  const isActive = isConnected || connectionStatus === "connecting"

  return (
    <main className="flex flex-col min-h-screen bg-[#0a0a0f] text-white items-center justify-center px-4">

      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl opacity-10 transition-all duration-1000 ${
          isActive ? 'bg-emerald-500 scale-150' : 'bg-blue-600 scale-100'
        }`} />
      </div>

      {/* Header */}
      <div className="mb-12 text-center z-10">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-blue-400" />
          <span className="text-xs text-blue-400 tracking-widest uppercase font-medium">
            AI Powered
          </span>
        </div>
        <h1 className="text-5xl font-bold tracking-tight mb-3">
          <span className="text-white">Smart</span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
            {" "}Scheduler
          </span>
        </h1>
        <p className="text-zinc-500 text-base">
          Your AI agent for effortless meeting scheduling
        </p>
      </div>

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-sm">
        <div className="bg-zinc-900/80 backdrop-blur-xl rounded-3xl border border-zinc-800/50 p-8 shadow-2xl">

          {/* Status */}
          <div className="text-center mb-8">
            <motion.p
              key={connectionStatus}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-sm font-medium ${getStatusColor()}`}
            >
              {getStatusLabel()}
            </motion.p>
          </div>

          {/* Central mic button */}
          <div className="flex justify-center mb-8">
            <motion.button
              whileHover={{ scale: isBusy ? 1 : 1.05 }}
              whileTap={{ scale: isBusy ? 1 : 0.95 }}
              onClick={isConnected ? disconnect : connect}
              disabled={isBusy}
              className="relative w-28 h-28 rounded-full flex items-center justify-center focus:outline-none"
            >
              {/* Pulse rings */}
              {isActive && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.4], opacity: [0.3, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute inset-0 rounded-full bg-emerald-500"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.7], opacity: [0.2, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                    className="absolute inset-0 rounded-full bg-emerald-500"
                  />
                </>
              )}

              {/* Button */}
              <div className={`relative w-28 h-28 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${
                isConnected
                  ? 'bg-gradient-to-br from-red-500 to-rose-600'
                  : isBusy
                  ? 'bg-gradient-to-br from-yellow-500 to-amber-600'
                  : 'bg-gradient-to-br from-emerald-400 to-teal-500'
              }`}>
                {isConnected ? (
                  <PhoneOff className="w-10 h-10 text-white" />
                ) : (
                  <Mic className={`w-10 h-10 text-white ${!isBusy ? 'animate-pulse' : ''}`} />
                )}
              </div>
            </motion.button>
          </div>

          {/* Waveform */}
          <div className="flex items-center justify-center gap-1 h-10">
            {[...Array(7)].map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  height: isActive
                    ? connectionStatus === "speaking"
                      ? ["15%", "100%", "15%"]
                      : connectionStatus === "listening"
                      ? ["15%", "60%", "15%"]
                      : ["15%", "35%", "15%"]
                    : "15%"
                }}
                transition={{
                  duration: connectionStatus === "speaking" ? 0.5 : 0.8,
                  repeat: Infinity,
                  delay: i * 0.08,
                  ease: "easeInOut"
                }}
                className={`w-1.5 rounded-full transition-colors duration-300 ${
                  connectionStatus === "speaking" ? 'bg-purple-400' :
                  connectionStatus === "listening" ? 'bg-blue-400' :
                  isActive ? 'bg-emerald-400' : 'bg-zinc-700'
                }`}
                style={{ height: '15%' }}
              />
            ))}
          </div>
        </div>

        {/* Meeting Card */}
        <AnimatePresence>
          {meeting && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16 }}
              className="mt-4 p-5 bg-zinc-900/80 backdrop-blur-xl rounded-3xl border border-emerald-500/20 shadow-xl"
            >
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-emerald-400 font-medium mb-1">Meeting Scheduled</p>
                  <h3 className="text-white font-semibold truncate">{meeting.summary}</h3>
                  <p className="text-zinc-400 text-sm mt-1">
                    {new Date(meeting.start).toLocaleString(undefined, {
                      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </p>
                  <a
                    href={meeting.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-3 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Open in Calendar
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <p className="mt-10 text-zinc-700 text-xs z-10">
        Powered by OpenAI Realtime API + Google Calendar
      </p>
    </main>
  )
}