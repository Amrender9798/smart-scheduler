'use client'
import React, { useState, useRef } from 'react'
import { Mic, MicOff, Calendar, ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'
import { useSession, signIn, signOut } from 'next-auth/react'

interface Meeting {
  summary: string
  start: string
  end: string
  link: string
  status: string
  eventId: string
}

export default function Home() {
  const { data: session, status: authStatus } = useSession()
  const [isConnected, setIsConnected] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState("Disconnected. Click to connect.")
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
    try {
      setConnectionStatus("Connecting...")

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
        setConnectionStatus("Connected! Speak to the scheduling assistant...")
      }

      dc.onmessage = async (event) => {
        const serverEvent = JSON.parse(event.data)
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
            setConnectionStatus("Meeting scheduled successfully!")
          } else if (name === "find_reference_event") {
            outputData = await callCalendarAPI("find_reference_event", {
              query: args.query
            })
          }

          const toolResultEvent = {
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: call_id,
              output: JSON.stringify(outputData)
            }
          }
          dc.send(JSON.stringify(toolResultEvent))
          dc.send(JSON.stringify({ type: "response.create" }))
        }
      }

      dc.onerror = () => {
        setConnectionStatus("Connection error")
        setIsBusy(false)
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setConnectionStatus("Connection lost. Click to reconnect.")
          setIsConnected(false)
          setIsBusy(false)
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
        throw new Error(`Backend signaling failed: ${errText}`)
      }

      const answerSdp = await response.text()
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp })

    } catch (err) {
      console.error("WebRTC Connection Error:", err)
      setConnectionStatus("Connection failed. Click to retry.")
      setIsBusy(false)
      disconnect()
    }
  }

  const disconnect = () => {
    if (dataChannel.current) {
      dataChannel.current.close()
      dataChannel.current = null
    }
    if (peerConnection.current) {
      peerConnection.current.close()
      peerConnection.current = null
    }
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop())
      localStream.current = null
    }
    document.querySelectorAll("audio").forEach(el => el.remove())
    setIsConnected(false)
    setIsBusy(false)
    setConnectionStatus("Disconnected. Click to connect.")
  }

  const toggleConnection = () => {
    if (isConnected) {
      disconnect()
    } else {
      connect()
    }
  }

  // Loading state
  if (authStatus === 'loading') {
    return (
      <main className="flex min-h-screen bg-gray-950 items-center justify-center">
        <p className="text-white">Loading...</p>
      </main>
    )
  }

  // Not logged in
  if (!session) {
    return (
      <main className="flex min-h-screen bg-gray-950 items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-3">
            <span className="text-blue-400">Smart</span>{' '}
            <span className="bg-blue-400/30 px-2 rounded">Scheduler</span>
          </h1>
          <p className="text-zinc-400 mb-10 text-lg">
            Talk to your AI agent to find the perfect meeting time.
          </p>
          <button
            onClick={() => signIn('google')}
            className="bg-white text-gray-900 px-6 py-3 rounded-full font-semibold flex items-center gap-3 mx-auto hover:bg-gray-100 transition shadow-lg"
          >
            <img
              src="https://www.google.com/favicon.ico"
              className="w-5 h-5"
              alt="Google"
            />
            Sign in with Google
          </button>
          <p className="text-zinc-600 text-xs mt-4">
            We only access your calendar to schedule meetings
          </p>
        </div>
      </main>
    )
  }

  // Logged in — main UI
  return (
    <main className="flex flex-col min-h-screen bg-gray-950 text-white items-center justify-center px-4">

      {/* Top bar */}
      <div className="absolute top-4 right-4 flex items-center gap-3">
        <p className="text-zinc-500 text-sm hidden sm:block">
          {session.user?.email}
        </p>
        <button
          onClick={() => signOut()}
          className="text-xs text-zinc-500 hover:text-white border border-zinc-700 px-3 py-1 rounded-full transition"
        >
          Sign out
        </button>
      </div>

      {/* Title */}
      <div className="mb-8 text-center z-10">
        <h1 className="text-4xl font-bold text-white mb-2">
          <span className="text-blue-400">Smart</span>{' '}
          <span className="bg-blue-400/30 px-2 rounded">Scheduler</span>
        </h1>
        <p className="text-zinc-400 min-h-[1.5rem] text-lg">
          Talk to your AI agent to find the perfect meeting time.
        </p>
      </div>

      {/* Voice Card */}
      <div className="flex flex-col items-center justify-center p-8 bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-800 max-w-md w-full mx-auto relative overflow-hidden">

        <div className="mb-8 text-center z-10">
          <p className="text-zinc-400 min-h-[1.5rem] text-sm">{connectionStatus}</p>
        </div>

        {/* Mic Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleConnection}
          disabled={isBusy}
          className={`z-10 w-32 h-32 rounded-full flex items-center justify-center shadow-lg transition-colors cursor-pointer ${isConnected
              ? 'bg-red-500 hover:bg-red-600 shadow-red-500/50'
              : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/50'
            } ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isConnected ? (
            <MicOff className="w-12 h-12 text-white" />
          ) : (
            <Mic className="w-12 h-12 text-white animate-pulse" />
          )}
        </motion.button>

        {/* Audio Visualizer */}
        <div className="mt-12 flex items-center gap-1 h-12 z-10">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ height: isConnected ? ["20%", "100%", "20%"] : "20%" }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.1,
                ease: "easeInOut"
              }}
              className={`w-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-zinc-600'}`}
              style={{ height: '20%' }}
            />
          ))}
        </div>

        {/* Meeting Preview Card */}
        {meeting && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 p-4 bg-zinc-800/80 rounded-2xl border border-zinc-700 w-full z-10"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                <Calendar className="w-6 h-6" />
              </div>
              <div className="flex-1 overflow-hidden">
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
                  className="inline-flex items-center gap-1 mt-3 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                View on Calendar <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
          </motion.div>
        )}
    </div>
    </main >
  )
}