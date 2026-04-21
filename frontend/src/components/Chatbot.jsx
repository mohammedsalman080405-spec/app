import { Loader2, MessageCircle, SendHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, getChatHistory, invalidateCachedGet } from "@/lib/api";

const STORAGE_KEY = "krishisage-chat-session";
const MAX_LOCAL_MESSAGES = 24;

function getSessionId() {
  if (typeof window === "undefined") {
    return "krishisage-web";
  }

  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const nextValue = window.crypto?.randomUUID?.() || `session-${Date.now()}`;
  window.localStorage.setItem(STORAGE_KEY, nextValue);
  return nextValue;
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBooting, setIsBooting] = useState(false);
  const [input, setInput] = useState("");
  const [sessionId] = useState(() => getSessionId());
  const [messages, setMessages] = useState(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const stored = window.localStorage.getItem(`${STORAGE_KEY}:${sessionId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [historyLoaded, setHistoryLoaded] = useState(messages.length > 0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      `${STORAGE_KEY}:${sessionId}`,
      JSON.stringify(messages.slice(-MAX_LOCAL_MESSAGES))
    );
  }, [messages, sessionId]);

  useEffect(() => {
    if (!isOpen || historyLoaded) {
      return undefined;
    }

    let ignore = false;

    async function loadHistory() {
      setIsBooting(true);
      try {
        const data = await getChatHistory(sessionId);
        if (!ignore) {
          setMessages(data.slice(-MAX_LOCAL_MESSAGES));
          setHistoryLoaded(true);
        }
      } catch {
        if (!ignore) {
          setHistoryLoaded(true);
        }
      } finally {
        if (!ignore) {
          setIsBooting(false);
        }
      }
    }

    loadHistory();
    return () => {
      ignore = true;
    };
  }, [historyLoaded, isOpen, sessionId]);

  async function handleSubmit(event) {
    event.preventDefault();
    const message = input.trim();
    if (!message || isLoading) {
      return;
    }

    const optimisticUserMessage = {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };

    setMessages((current) => [...current, optimisticUserMessage]);
    setInput("");
    setIsLoading(true);
    invalidateCachedGet(`/chat/${sessionId}`);

    try {
      const { data } = await api.post("/chat", {
        session_id: sessionId,
        message,
      });
      setMessages((current) => [
        ...current.slice(-(MAX_LOCAL_MESSAGES - 2)),
        {
          role: "assistant",
          content: data.reply,
          timestamp: new Date().toISOString(),
        },
      ]);
      setHistoryLoaded(true);
    } catch {
      toast.error("Chat service is unavailable right now.");
      setMessages((current) =>
        current.filter(
          (item) => !(item.role === optimisticUserMessage.role && item.timestamp === optimisticUserMessage.timestamp)
        )
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        data-testid="chatbot-toggle"
        onClick={() => setIsOpen((current) => !current)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-white shadow-lg shadow-emerald-700/30 transition-transform hover:scale-105 hover:bg-emerald-800"
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>

      {isOpen && (
        <section
          data-testid="chatbot-panel"
          className="fixed bottom-24 right-6 z-50 flex h-[34rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl"
        >
          <div className="border-b border-stone-200 bg-emerald-900 px-5 py-4 text-white">
            <div className="font-display text-lg font-black">KrishiMitra</div>
            <p className="mt-1 text-sm text-emerald-100">Ask about crops, irrigation, pests, fertilizers, or weather.</p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-stone-50 p-4">
            {isBooting ? (
              <div className="flex h-full items-center justify-center text-sm text-stone-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading chat history...
              </div>
            ) : messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-4 text-sm text-stone-500">
                Try asking: "Which crop suits loamy soil in Punjab during rabi?"
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={`${message.timestamp}-${index}`}
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    message.role === "user"
                      ? "ml-auto bg-emerald-700 text-white"
                      : "bg-white text-stone-700"
                  }`}
                >
                  {message.content}
                </div>
              ))
            )}

            {isLoading && (
              <div className="max-w-[85%] rounded-2xl bg-white px-4 py-3 text-sm text-stone-500 shadow-sm">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                Thinking...
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-stone-200 bg-white p-3">
            <div className="flex items-end gap-2">
              <textarea
                data-testid="chatbot-input"
                rows={2}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Type your farming question..."
                className="min-h-[3rem] flex-1 resize-none rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white"
              />
              <button
                type="submit"
                data-testid="chatbot-send"
                disabled={!input.trim() || isLoading}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-stone-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <SendHorizontal className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
