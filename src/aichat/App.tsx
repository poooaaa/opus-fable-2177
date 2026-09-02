import React, { useState, useRef, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Zap,
  ChevronDown,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Camera,
  Search,
  Check,
  AlertCircle,
  ArrowUpLeft,
} from "lucide-react";
import { ProjectContextIcon } from "./components/ProjectIcon";
import { MarkdownText } from "./components/MarkdownText";
import { ClaudeCopyIcon } from "./components/CopyIcon";
import aiAvatar from "@/assets/ai-avatar.png";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: string;
  thumbState?: "up" | "down" | null;
  isPending?: boolean;
}

function getFormattedTime(): string {
  const date = new Date();
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12 || 12;
  return `${hours}:${minutes}${ampm}`;
}

interface ChatAuth {
  cookie: string;
  id: string;
}

interface ChatApiResult {
  response?: string;
  chatId?: string | null;
  auth?: ChatAuth;
  error?: string;
}

async function requestAnswer(
  prompt: string,
  auth: ChatAuth | null,
  chatId: string | null,
): Promise<ChatApiResult> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, auth, chatId }),
  });
  const data = (await res.json().catch(() => ({}))) as ChatApiResult;
  if (!res.ok) {
    throw new Error(data.error || `Gagal menghubungi AI (${res.status}).`);
  }
  return data;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg-1",
      role: "user",
      text: "hi",
      time: "4:31pm",
    },
    {
      id: "msg-2",
      role: "assistant",
      text: "Hello! How’s your day going so far?",
      time: "4:32pm",
      thumbState: null,
    },
  ]);

  const [activeTooltip, setActiveTooltip] = useState<{
    id: string;
    type: "liked" | "disliked" | "refreshed" | "copied";
  } | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamEndRef = useRef<HTMLDivElement>(null);

  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);
  const [copiedSuggestion, setCopiedSuggestion] = useState<{ id: string; rect: DOMRect } | null>(
    null,
  );

  const [isSending, setIsSending] = useState(false);
  const authRef = useRef<ChatAuth | null>(null);
  const chatIdRef = useRef<string | null>(null);
  const lastPromptRef = useRef<string>("");

  // Fetch real-time live suggestions from Google Suggest API (http://suggestqueries.google.com/complete/search?client=chrome&q={query})
  useEffect(() => {
    const query = inputValue.trim();
    if (!query) {
      setDynamicSuggestions([]);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        // Query Google Suggest API endpoint (http://suggestqueries.google.com/complete/search?client=chrome&q={query})
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          // Google suggest format: [query, [suggestions...], ...]
          const rawList: string[] = Array.isArray(data?.[1]) ? data[1] : [];
          const list = rawList.filter(
            (item: string) =>
              typeof item === "string" && item.toLowerCase() !== query.toLowerCase(),
          );
          if (isMounted && list.length > 0) {
            setDynamicSuggestions(list);
            return;
          }
        }
      } catch {
        // network fallback if proxy unavailable
      }

      // Resilient fallback to OpenSearch if needed
      try {
        const resId = await fetch(
          `https://id.wikipedia.org/w/api.php?action=opensearch&format=json&origin=*&search=${encodeURIComponent(
            query,
          )}&limit=20`,
        );
        if (resId.ok) {
          const dataId = await resId.json();
          const liveId: string[] = (dataId[1] || []).filter(
            (item: string) => item.toLowerCase() !== query.toLowerCase(),
          );
          if (isMounted && liveId.length > 0) {
            setDynamicSuggestions(liveId);
            return;
          }
        }
      } catch {
        // ignore
      }

      if (isMounted) {
        setDynamicSuggestions([]);
      }
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [inputValue]);

  const suggestions = useMemo(() => {
    if (!inputValue.trim()) return [];
    return dynamicSuggestions;
  }, [inputValue, dynamicSuggestions]);

  const triggerTooltip = (id: string, type: "liked" | "disliked" | "refreshed" | "copied") => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setActiveTooltip({ id, type });
    tooltipTimeoutRef.current = setTimeout(() => {
      setActiveTooltip(null);
    }, 1800);
  };

  const handleCopy = (msgId: string, text: string) => {
    navigator.clipboard?.writeText(text);
    triggerTooltip(msgId, "copied");
  };

  const handleCopySuggestion = (sugId: string, text: string, rect: DOMRect) => {
    navigator.clipboard?.writeText(text);
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setCopiedSuggestion({ id: sugId, rect });
    tooltipTimeoutRef.current = setTimeout(() => {
      setCopiedSuggestion(null);
    }, 1800);
  };

  // Scrolling the recommendations list instantly dismisses the floating "Copied!" tooltip,
  // since its position is anchored to a viewport rect that goes stale on scroll.
  const dismissSuggestionTooltip = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setCopiedSuggestion(null);
  };

  const runPrompt = async (prompt: string, targetMsgId: string) => {
    try {
      const data = await requestAnswer(prompt, authRef.current, chatIdRef.current);
      if (data.auth) authRef.current = data.auth;
      if (data.chatId) chatIdRef.current = data.chatId;
      const answer = data.response?.trim();
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === targetMsgId
            ? {
                ...msg,
                text: answer || "Tidak ada jawaban yang diterima. Coba kirim ulang.",
                isPending: false,
              }
            : msg,
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Terjadi kesalahan tak terduga.";
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === targetMsgId ? { ...msg, text: message, isPending: false } : msg,
        ),
      );
    }
  };

  const handleRotate = async (msgId: string, originalText: string) => {
    const prompt = lastPromptRef.current;
    if (!prompt || isSending) return;

    setRotatingId(msgId);
    setIsSending(true);
    triggerTooltip(msgId, "refreshed");

    setMessages((prev) =>
      prev.map((msg) => (msg.id === msgId ? { ...msg, text: "", isPending: true } : msg)),
    );

    try {
      await runPrompt(prompt, msgId);
    } finally {
      setRotatingId(null);
      setIsSending(false);
      void originalText;
    }
  };

  const toggleThumb = (msgId: string, type: "up" | "down") => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === msgId) {
          const next = msg.thumbState === type ? null : type;
          if (type === "up" && next === "up") {
            triggerTooltip(msgId, "liked");
          } else if (type === "down" && next === "down") {
            triggerTooltip(msgId, "disliked");
          } else {
            setActiveTooltip(null);
          }
          return { ...msg, thumbState: next };
        }
        return msg;
      }),
    );
  };

  const handleSearchSubmit = async (customQuery?: string) => {
    const query = (customQuery ?? inputValue).trim();
    if (!query || isSending) return;

    const userTime = getFormattedTime();
    const assistantId = `ai-${Date.now() + 1}`;

    const newUserMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      text: query,
      time: userTime,
    };

    const pendingAssistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      text: "",
      time: userTime,
      thumbState: null,
      isPending: true,
    };

    lastPromptRef.current = query;
    setMessages((prev) => [...prev, newUserMsg, pendingAssistantMsg]);
    setInputValue("");
    setDynamicSuggestions([]);
    setCopiedSuggestion(null);
    inputRef.current?.focus();

    setIsSending(true);
    try {
      await runPrompt(query, assistantId);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Any page-level scroll/resize also invalidates the tooltip anchor.
  useEffect(() => {
    if (!copiedSuggestion) return;
    const dismiss = () => setCopiedSuggestion(null);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [copiedSuggestion]);

  return (
    <main
      id="chat-screen-root"
      className="min-h-screen w-full bg-[#111113] text-[#ececee] flex flex-col justify-between items-center selection:bg-[#d7573b]/30 selection:text-white font-['Inter',sans-serif]"
    >
      {/* Outer container matching mobile phone viewport width and exact layout */}
      <div
        id="chat-viewport-container"
        className="w-full max-w-[440px] flex-1 flex flex-col justify-between px-4 sm:px-5 py-6 sm:py-8 relative"
      >
        {/* Main Conversation Stream */}
        <div
          id="conversation-stream"
          className="flex-1 flex flex-col justify-start w-full overflow-y-auto max-h-[calc(100vh-140px)] pr-0.5 no-scrollbar"
        >
          {messages.map((msg) => {
            if (msg.role === "user") {
              return (
                <div
                  key={msg.id}
                  id={`user-message-${msg.id}`}
                  className="w-full flex justify-end pt-4 sm:pt-6 pr-1"
                >
                  <div
                    id="user-message-bubble"
                    className="bg-[#222225] text-white px-5 py-2.5 rounded-[10px] text-[16.5px] sm:text-[17px] leading-relaxed font-normal tracking-normal shadow-sm hover:bg-[#28282c] transition-colors cursor-default max-w-[85%] break-words"
                  >
                    {msg.text}
                  </div>
                </div>
              );
            }

            const isLiked = msg.thumbState === "up";
            const isDisliked = msg.thumbState === "down";
            const isCopied = activeTooltip?.id === msg.id && activeTooltip.type === "copied";
            const isMsgRotating = rotatingId === msg.id;
            const isPending = msg.isPending === true;

            return (
              <div key={msg.id} id={`assistant-message-${msg.id}`} className="w-full mt-7 sm:mt-9">
                <div id="assistant-content-row" className="flex items-start gap-3.5">
                  {/* AI Avatar Icon */}
                  <div className="relative h-[34px] w-[34px] shrink-0 -mt-1">
                    <img
                      id="ai-avatar-image"
                      src={aiAvatar}
                      alt="AI avatar"
                      className={`absolute inset-0 m-auto h-[30px] w-[30px] rounded-[9px] object-cover select-none shadow-sm ${isPending ? "avatar-spinning" : ""}`}
                    />
                  </div>

                  {/* Message Text */}
                  <div id="assistant-text-wrapper" className="flex-1 min-w-0">
                    {!isPending && <MarkdownText text={msg.text} />}
                  </div>
                </div>

                {/* Action Bar (Thumbs, Reload, Copy, Timestamp) */}
                {!isPending && (
                  <div
                    id="assistant-actions-bar"
                    className="flex items-center justify-between mt-5 pl-[44px] pr-1 select-none"
                  >
                    {/* Left Action Buttons */}
                    <div
                      id="action-buttons-group"
                      className="flex items-center gap-4 sm:gap-4.5 text-[#73737c]"
                    >
                      {/* Thumbs Up (Material Symbols) */}
                      <button
                        id={`btn-thumbs-up-${msg.id}`}
                        type="button"
                        onClick={() => toggleThumb(msg.id, "up")}
                        aria-label="Good response"
                        className="group p-1 -m-1 rounded-md transition-colors relative flex items-center justify-center text-[#73737c] hover:text-[#d4d4d8]"
                      >
                        <span
                          className={`material-symbols-outlined text-[19px] transition-colors leading-none select-none ${
                            isLiked ? "filled text-[#73737c]" : "text-[#73737c]"
                          }`}
                        >
                          thumb_up
                        </span>
                        {activeTooltip?.id === msg.id && activeTooltip.type === "liked" && (
                          <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#2a2a2f] text-white text-[11px] px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-20 animate-in fade-in">
                            Liked!
                          </span>
                        )}
                      </button>

                      {/* Thumbs Down (Material Symbols) */}
                      <button
                        id={`btn-thumbs-down-${msg.id}`}
                        type="button"
                        onClick={() => toggleThumb(msg.id, "down")}
                        aria-label="Bad response"
                        className="group p-1 -m-1 rounded-md transition-colors relative flex items-center justify-center text-[#73737c] hover:text-[#d4d4d8]"
                      >
                        <span
                          className={`material-symbols-outlined text-[19px] transition-colors leading-none select-none ${
                            isDisliked ? "filled text-[#73737c]" : "text-[#73737c]"
                          }`}
                        >
                          thumb_down
                        </span>
                        {activeTooltip?.id === msg.id && activeTooltip.type === "disliked" && (
                          <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#2a2a2f] text-white text-[11px] px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-20 animate-in fade-in">
                            Disliked!
                          </span>
                        )}
                      </button>

                      {/* Retry / Regenerate (Modern Sleek Refresh) */}
                      <button
                        id={`btn-retry-${msg.id}`}
                        type="button"
                        onClick={() => handleRotate(msg.id, msg.text)}
                        aria-label="Regenerate response"
                        className="p-1 -m-1 rounded-md transition-colors hover:text-[#d4d4d8] relative flex items-center justify-center text-[#73737c]"
                      >
                        <svg
                          width="17.5"
                          height="17.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={`transition-transform duration-500 ${isMsgRotating ? "rotate-180" : ""}`}
                        >
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L2 8" />
                          <path d="M2 3v5h5" />
                        </svg>
                        {activeTooltip?.id === msg.id && activeTooltip.type === "refreshed" && (
                          <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#2a2a2f] text-white text-[11px] px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-20 animate-in fade-in">
                            Refreshed!
                          </span>
                        )}
                      </button>

                      {/* Copy (Matching Claude visual 100%) */}
                      <button
                        id={`btn-copy-${msg.id}`}
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.text)}
                        aria-label="Copy text"
                        className="p-1 -m-1 rounded-md transition-colors hover:text-[#d4d4d8] relative flex items-center justify-center text-[#73737c]"
                      >
                        {isCopied ? (
                          <Check size={17.5} strokeWidth={2.2} className="text-emerald-400" />
                        ) : (
                          <ClaudeCopyIcon size={17.5} />
                        )}
                        {isCopied && (
                          <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#2a2a2f] text-white text-[11px] px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-20 animate-in fade-in">
                            Copied!
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Timestamp on Right */}
                    <div
                      id={`message-timestamp-${msg.id}`}
                      className="text-[#5f5f67] text-[14px] font-normal tracking-normal"
                    >
                      {msg.time}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={streamEndRef} />
        </div>

        {/* Bottom Floating Composer / Input Bar */}
        <div id="bottom-composer-section" className="w-full mt-auto pt-4 relative">
          {/* Autocomplete / Recommendations Card without any border/radius, height for ~5 items, full width left-to-right */}
          {inputValue.trim().length > 0 && suggestions.length > 0 && (
            <div
              id="search-recommendations-card"
              onScroll={dismissSuggestionTooltip}
              onTouchMove={dismissSuggestionTooltip}
              onWheel={dismissSuggestionTooltip}
              className="absolute bottom-[calc(100%-8px)] -left-4 -right-4 sm:-left-5 sm:-right-5 bg-[#121215] shadow-2xl z-30 flex flex-col max-h-[225px] overflow-y-auto overscroll-contain animate-in fade-in slide-in-from-bottom-2 duration-150 py-1.5"
            >
              {suggestions.map((suggestion, idx) => {
                const sugId = `sug-${idx}`;
                const isCopied = copiedSuggestion?.id === sugId;
                return (
                  <div
                    key={idx}
                    id={`search-recommendation-item-${idx}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setInputValue(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="flex items-center px-4 sm:px-5 py-2.5 hover:bg-[#1d1d22] text-left transition-colors group cursor-pointer w-full select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0 w-full">
                      {/* Copy Button matching AI message action bar copy 100% */}
                      <button
                        id={`btn-copy-sug-${idx}`}
                        type="button"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const rect = e.currentTarget.getBoundingClientRect();
                          handleCopySuggestion(sugId, suggestion, rect);
                        }}
                        aria-label="Copy recommendation text"
                        className="p-1 -m-1 rounded-md transition-colors hover:text-[#d4d4d8] relative flex items-center justify-center text-[#73737c] shrink-0"
                      >
                        {isCopied ? (
                          <Check size={17.5} strokeWidth={2.2} className="text-emerald-400" />
                        ) : (
                          <ClaudeCopyIcon size={17.5} />
                        )}
                      </button>
                      <span className="text-[14.5px] text-[#d4d4d8] group-hover:text-white truncate font-normal">
                        {suggestion}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Floating "Copied!" tooltip for suggestion copy — rendered via portal so it sits above the overflow container */}
          {copiedSuggestion &&
            createPortal(
              <span
                className="fixed bg-[#2a2a2f] text-white text-[11px] px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-[100] animate-in fade-in pointer-events-none"
                style={{
                  left: copiedSuggestion.rect.left + copiedSuggestion.rect.width / 2,
                  top: copiedSuggestion.rect.top - 8,
                  transform: "translate(-50%, -100%)",
                }}
              >
                Copied!
              </span>,
              document.body,
            )}

          <div
            id="composer-container-card"
            className="w-full bg-[#1c1c20] rounded-[22px] px-4 pt-3.5 pb-3 border border-[#27272d]/60 shadow-xl"
          >
            {/* Input field row */}
            <div id="composer-input-row" className="w-full mb-3">
              <input
                id="message-input-field"
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void handleSearchSubmit();
                  }
                }}
                placeholder="Ask anything"
                className="w-full bg-transparent text-[#ececee] placeholder-[#64646c] text-[16.5px] font-normal outline-none focus:ring-0 border-none p-0"
              />
            </div>

            {/* Bottom tools row */}
            <div id="composer-tools-row" className="flex items-center justify-between select-none">
              {/* Left tools: + and 1/4 context badge */}
              <div id="composer-left-actions" className="flex items-center gap-4 relative">
                {/* Plus button */}
                <button
                  id="btn-composer-plus"
                  type="button"
                  onClick={() => setShowAttachMenu((prev) => !prev)}
                  aria-label="Add attachment"
                  className="text-[#8e8e96] hover:text-white transition-colors p-1 -m-1"
                >
                  <Plus size={20} strokeWidth={2} />
                </button>

                {/* Context badge: Project icon with 1/4 */}
                <div
                  id="project-counter-badge"
                  className="flex items-center gap-1.5 text-[#8e8e96] hover:text-[#c4c4cc] transition-colors cursor-pointer"
                  title="Context files used (1 of 4)"
                >
                  <ProjectContextIcon size={16} className="text-[#8e8e96]" />
                  <span className="text-[13.5px] font-medium tracking-tight">1/4</span>
                </div>

                {/* Attach Popup Menu */}
                {showAttachMenu && (
                  <div
                    id="attach-menu-dropdown"
                    className="absolute bottom-10 left-0 bg-[#25252b] border border-[#33333d] rounded-xl py-2 px-1 shadow-2xl z-20 w-44 flex flex-col gap-1 text-sm animate-in fade-in slide-in-from-bottom-2 duration-150"
                  >
                    <button
                      type="button"
                      onClick={() => setShowAttachMenu(false)}
                      className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-[#32323a] text-[#ececee] text-left transition-colors"
                    >
                      <Paperclip size={15} className="text-[#8e8e96]" />
                      <span>Upload file</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAttachMenu(false)}
                      className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-[#32323a] text-[#ececee] text-left transition-colors"
                    >
                      <ImageIcon size={15} className="text-[#8e8e96]" />
                      <span>Upload image</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAttachMenu(false)}
                      className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-[#32323a] text-[#ececee] text-left transition-colors"
                    >
                      <Camera size={15} className="text-[#8e8e96]" />
                      <span>Take photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAttachMenu(false)}
                      className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-[#32323a] text-[#ececee] text-left transition-colors"
                    >
                      <FileText size={15} className="text-[#8e8e96]" />
                      <span>Add document</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Right tools: Lightning status & Search/Alert Action Button */}
              <div id="composer-right-actions" className="flex items-center gap-2.5 relative">
                {/* Lightning pill (static, no dropdown per request) */}
                <button
                  id="btn-model-switch"
                  type="button"
                  aria-label="Model status"
                  className="bg-[#29292e] text-[#d4d4d8] hover:bg-[#313138] transition-colors px-2.5 py-1.5 rounded-[10px] flex items-center gap-1.5 border border-[#33333a]/40 cursor-default"
                >
                  <Zap size={14} className="fill-[#d4d4d8] text-[#d4d4d8]" />
                  <ChevronDown size={13} strokeWidth={2.2} className="text-[#8e8e96]" />
                </button>

                {/* Exclamation mark when input empty, Magnifying glass search icon when typed */}
                <button
                  id="btn-composer-action"
                  type="button"
                  onClick={() => void handleSearchSubmit()}
                  disabled={isSending}
                  aria-label={inputValue.trim() ? "Search or submit" : "Info"}
                  className="bg-[#29292e] text-[#d4d4d8] hover:bg-[#313138] transition-colors w-[34px] h-[34px] rounded-[10px] flex items-center justify-center border border-[#33333a]/40 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSending ? (
                    <span className="w-[13px] h-[13px] rounded-full border-2 border-[#8e8e96] border-t-transparent animate-spin" />
                  ) : inputValue.trim().length === 0 ? (
                    <AlertCircle size={15} strokeWidth={2.2} className="text-[#8e8e96]" />
                  ) : (
                    <Search size={15} strokeWidth={2.3} className="text-[#d4d4d8]" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
