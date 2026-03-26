import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Mic, MicOff, Loader2, Volume2, VolumeX } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AiAssistantProps {
  apiKey: string;
  aiProvider?: 'openai' | 'azure-openai';
  azureEndpoint?: string;
  azureDeployment?: string;
  openaiModel?: string;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const SYSTEM_PROMPT =
  'You are a helpful family assistant for the Pikes family dashboard. You can help with scheduling, chores, meal ideas, and general questions. Keep answers concise and family-friendly.';

function getSpeechRecognition(): (new () => SpeechRecognition) | null {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function AiAssistant({ apiKey, aiProvider = 'openai', azureEndpoint = '', azureDeployment = '', openaiModel = 'gpt-4o-mini' }: AiAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  /* -- Text-to-speech ---------------------------------------------------- */

  const speak = (text: string) => {
    if (!speakEnabled || !window.speechSynthesis) return;
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    // Strip emoji/symbols for cleaner speech
    const clean = text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}⚠️]/gu, '').trim();
    if (!clean) return;
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  /* -- Send message to AI ------------------------------------------------ */

  const sendMessage = async (text: string) => {
    if (!text.trim() || !apiKey || loading) return;

    const userMsg: Message = { role: 'user', content: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      let url: string;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (aiProvider === 'azure-openai' && azureEndpoint && azureDeployment) {
        const base = azureEndpoint.replace(/\/$/, '');
        url = `${base}/openai/deployments/${encodeURIComponent(azureDeployment)}/chat/completions?api-version=2024-02-01`;
        headers['api-key'] = apiKey;
      } else {
        url = 'https://api.openai.com/v1/chat/completions';
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const body: Record<string, unknown> = {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...updated.map((m) => ({ role: m.role, content: m.content })),
        ],
        max_tokens: 500,
      };

      // Only include model for OpenAI (Azure uses deployment name)
      if (aiProvider !== 'azure-openai') {
        body.model = openaiModel || 'gpt-4o-mini';
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let detail = `${res.status}`;
        try {
          const errBody = await res.json();
          detail = errBody?.error?.message || errBody?.message || detail;
        } catch { /* ignore */ }
        if (aiProvider === 'azure-openai' && res.status === 404) {
          throw new Error(`404 — deployment "${azureDeployment}" not found. Check the deployment name in Azure AI Foundry matches exactly.`);
        }
        throw new Error(`API error: ${detail}`);
      }

      const data = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      const reply =
        data.choices?.[0]?.message?.content ??
        'Sorry, I could not generate a response.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      speak(reply);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Something went wrong';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠️ ${errorMsg}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  /* -- Voice input ------------------------------------------------------- */

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        setInput(transcript);
        sendMessage(transcript);
      }
      setListening(false);
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const hasSpeech = !!getSpeechRecognition();

  /* -- Render ------------------------------------------------------------ */

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      {/* Chat panel — always mounted for smooth animation */}
      <div
        className={`w-[350px] h-[500px] bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 origin-bottom-right ${
          isOpen
            ? 'scale-100 opacity-100 pointer-events-auto'
            : 'scale-90 opacity-0 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
              <MessageCircle size={16} />
            </div>
            <span className="font-semibold text-sm">Family Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setSpeakEnabled(!speakEnabled);
                if (speakEnabled) window.speechSynthesis?.cancel();
              }}
              className={`p-1.5 rounded-lg transition-colors ${
                speakEnabled ? 'text-blue-400 hover:bg-white/10' : 'text-white/30 hover:bg-white/10'
              }`}
              title={speakEnabled ? 'Mute voice' : 'Enable voice'}
            >
              {speakEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              onClick={() => { setIsOpen(false); window.speechSynthesis?.cancel(); }}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!apiKey && (
            <div className="text-center text-sm text-white/40 py-8">
              🔑 Set up your OpenAI API key in Settings
            </div>
          )}
          {messages.length === 0 && apiKey && (
            <div className="text-center text-sm text-white/40 py-8">
              <p>👋 Hi! I&apos;m your family assistant.</p>
              <p className="mt-1">
                Ask me about schedules, meal ideas, chores, or anything!
              </p>
              <p className="mt-2 text-xs">
                🎤 Tap the mic to talk &nbsp;·&nbsp; 🔊 I&apos;ll read my answers aloud
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-white/10 text-white/90 rounded-bl-md'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/10 px-4 py-3 rounded-2xl rounded-bl-md">
                <Loader2 size={16} className="animate-spin text-white/50" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-white/10 shrink-0">
          <div className="flex gap-2">
            {hasSpeech && (
              <button
                onClick={toggleVoice}
                className={`p-2.5 rounded-xl transition-colors ${
                  listening
                    ? 'bg-red-500/30 text-red-400'
                    : 'hover:bg-white/10 text-white/50'
                }`}
                title={listening ? 'Stop listening' : 'Voice input'}
              >
                {listening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            )}
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === 'Enter' && !e.shiftKey && sendMessage(input)
              }
              placeholder={apiKey ? 'Ask me anything...' : 'API key needed'}
              disabled={!apiKey}
              className="flex-1 rounded-xl bg-white/10 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!apiKey || !input.trim() || loading}
              className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-blue-600 rounded-xl text-white transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Floating bubble */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? 'bg-slate-700 hover:bg-slate-600'
            : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/30 hover:scale-105'
        }`}
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}

export default AiAssistant;
