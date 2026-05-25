'use client'
import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your scheduling assistant. How can I help you today?"
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Groq TTS — natural sounding voice
  const speak = async (text: string) => {
    try {
      setIsSpeaking(true)
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })

      if (!response.ok) throw new Error('TTS failed')

      const audioBuffer = await response.arrayBuffer()
      const audioContext = new AudioContext()
      const decodedAudio = await audioContext.decodeAudioData(audioBuffer)
      const source = audioContext.createBufferSource()
      source.buffer = decodedAudio
      source.connect(audioContext.destination)
      source.onended = () => setIsSpeaking(false)
      source.start(0)
    } catch (error) {
      console.error('TTS error:', error)
      // Fallback to browser TTS if Groq TTS fails
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.onend = () => setIsSpeaking(false)
      window.speechSynthesis.speak(utterance)
    }
  }

  // Send message to chat API
  const sendMessage = async (text: string) => {
    if (!text.trim()) return

    const userMessage: Message = { role: 'user', content: text }
    const updatedMessages = [...messages, userMessage]

    setMessages(updatedMessages)
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages })
      })

      const data = await response.json()
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.reply
      }

      setMessages(prev => [...prev, assistantMessage])
      await speak(data.reply)
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  // Groq Whisper STT — accurate speech recognition
  const startListening = () => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        const recorder = new MediaRecorder(stream)
        const chunks: BlobPart[] = []

        recorder.ondataavailable = (e) => chunks.push(e.data)

        recorder.onstop = async () => {
          setIsListening(false)
          const blob = new Blob(chunks, { type: 'audio/webm' })
          const formData = new FormData()
          formData.append('audio', blob, 'recording.webm')

          try {
            const response = await fetch('/api/stt', {
              method: 'POST',
              body: formData
            })
            const { text } = await response.json()
            if (text?.trim()) sendMessage(text)
          } catch (err) {
            console.error('STT error:', err)
          }

          stream.getTracks().forEach(t => t.stop())
        }

        recorder.start()
        recognitionRef.current = recorder as unknown as SpeechRecognition
        setIsListening(true)

        // Auto stop after 8 seconds
        setTimeout(() => {
          if (recorder.state === 'recording') recorder.stop()
        }, 6000)
      })
      .catch(() => {
        alert('Microphone access denied. Please allow microphone access.')
      })
  }

  const stopListening = () => {
    const recorder = recognitionRef.current as unknown as MediaRecorder
    if (recorder && recorder.state === 'recording') {
      recorder.stop()
    }
    setIsListening(false)
  }

  return (
    <main className="flex flex-col h-screen bg-gray-950 text-white">

      {/* Header */}
      <div className="p-4 border-b border-gray-800 text-center">
        <h1 className="text-xl font-semibold">Smart Scheduler</h1>
        <p className="text-sm text-gray-400">AI Meeting Assistant</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-100'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl px-4 py-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-800">

        {isListening && (
          <div className="text-center text-sm text-blue-400 mb-2 animate-pulse">
            🎤 Listening... (speak now, auto-stops in 6s)
          </div>
        )}
        {isSpeaking && (
          <div className="text-center text-sm text-green-400 mb-2 animate-pulse">
            🔊 Speaking...
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            placeholder="Type a message or use mic..."
            className="flex-1 bg-gray-800 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-full w-10 h-10 flex items-center justify-center"
          >
            ➤
          </button>

          <button
            onClick={isListening ? stopListening : startListening}
            disabled={isLoading || isSpeaking}
            className={`rounded-full w-10 h-10 flex items-center justify-center transition-colors ${
              isListening
                ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            🎤
          </button>
        </div>
      </div>
    </main>
  )
}