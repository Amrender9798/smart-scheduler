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

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Text to speech
  const speak = (text: string) => {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }

  // Send message to API
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
      speak(data.reply) // speak the response
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  // Voice input using Web Speech API
  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      alert('Speech recognition not supported in this browser. Use Chrome.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript
      sendMessage(transcript)
    }

    recognition.onerror = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
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

        {/* Loading indicator */}
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

        {/* Voice status */}
        {isListening && (
          <div className="text-center text-sm text-blue-400 mb-2 animate-pulse">
            Listening...
          </div>
        )}
        {isSpeaking && (
          <div className="text-center text-sm text-green-400 mb-2 animate-pulse">
            Speaking...
          </div>
        )}

        <div className="flex gap-2">
          {/* Text input */}
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-800 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Send button */}
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-full w-10 h-10 flex items-center justify-center"
          >
            ➤
          </button>

          {/* Voice button */}
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={isLoading}
            className={`rounded-full w-10 h-10 flex items-center justify-center transition-colors ${
              isListening
                ? 'bg-red-500 hover:bg-red-600'
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