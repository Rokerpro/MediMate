"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { ChatResponse } from "@/lib/validations";
import { GroundedAssessment } from "@/components/grounded-assessment";
import { SaveToLog } from "@/components/save-to-log";
import {
  useAssistantExperience,
  type AssistantChatMessage,
} from "@/components/assistant-experience";

type SpeechRecognitionResultLike = ArrayLike<{ transcript: string }> & { isFinal: boolean };

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorLike = { error: string };

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

/** English locales the browser speech services support; anything else falls back to en-US. */
function speechLanguage(): string {
  const language = navigator.language;
  return /^en-(US|GB|AU|CA|IN|IE|NZ|ZA)$/i.test(language) ? language : "en-US";
}

/** User-facing text for a SpeechRecognition error code. */
function speechErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone or speech service access was not allowed. Allow it in your browser settings, or type your message instead.";
    case "network":
      return "The browser's speech service could not be reached. Voice input needs an internet connection and works in Chrome or Edge; Brave and some privacy browsers block it. You can type your message instead.";
    case "no-speech":
      return "No speech was heard. Press the microphone and start speaking straight away, or type your message instead.";
    case "audio-capture":
      return "No audio was captured from your microphone. Check it is connected and selected, or type your message instead.";
    case "language-not-supported":
      return "Voice input does not support this language setting. You can type your message instead.";
    case "aborted":
      return "Voice input was stopped.";
    default:
      return "Voice input could not be completed. You can type your message instead.";
  }
}

function microphonePermissionMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Microphone access was denied. Allow it in your browser settings, then try again or type your message.";
    }
    if (error.name === "NotFoundError") {
      return "No microphone was found. Connect a microphone or type your message instead.";
    }
    if (error.name === "NotReadableError") {
      return "The microphone is busy or unavailable. Check it and try again or type your message.";
    }
  }
  return "Microphone permission could not be requested. You can type your message instead.";
}

export function AssistantChat({
  variant = "page",
  active = true,
  onClose,
}: {
  variant?: "page" | "popup";
  active?: boolean;
  onClose?: () => void;
}) {
  const experience = useAssistantExperience();
  const pathname = usePathname();
  const messages = experience.activeConversation?.messages ?? [];
  const latestResponse = [...messages].reverse().find((message) => message.response)?.response ?? null;
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [requestingMicrophone, setRequestingMicrophone] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceRequestSequenceRef = useRef(0);
  const microphoneRequestPendingRef = useRef(false);
  const messageInputId = variant === "popup" ? "assistant-popup-message" : "assistant-message";
  const loading = experience.isSending;
  const errorMessage = experience.errorMessage;
  const retryAvailable = experience.retryAvailable;
  const dark = experience.theme === "dark";
  const signInHref = `/auth/login?next=${encodeURIComponent(pathname)}`;
  const conversations = experience.conversations
    .filter((conversation) => {
      const query = search.trim().toLocaleLowerCase();
      return !query || conversation.title.toLocaleLowerCase().includes(query)
        || conversation.messages.some((message) => message.content.toLocaleLowerCase().includes(query));
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  useEffect(() => {
    if (active) return;

    voiceRequestSequenceRef.current += 1;
    if (isListening) recognitionRef.current?.stop();
  }, [active, isListening]);

  useEffect(() => () => {
    voiceRequestSequenceRef.current += 1;
    recognitionRef.current?.stop();
  }, []);

  async function submitMessage() {
    const trimmedMessage = input.trim();
    if (!trimmedMessage || loading) return;
    if (isListening) recognitionRef.current?.stop();
    if (await experience.sendMessage(trimmedMessage)) setInput("");
  }

  function startOver() {
    if (isListening) recognitionRef.current?.stop();
    setInput("");
    experience.createConversation();
  }

  function selectFollowUpQuestion(question: string) {
    setInput(question);
    requestAnimationFrame(() => messageInputRef.current?.focus());
  }

  async function toggleVoiceInput() {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    if (microphoneRequestPendingRef.current) return;

    const speechWindow = window as SpeechRecognitionWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceStatus("Voice input is not supported in this browser. You can type your message instead.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceStatus(
        "Microphone access is unavailable here. Use HTTPS or localhost, or type your message instead.",
      );
      return;
    }

    const requestId = ++voiceRequestSequenceRef.current;
    microphoneRequestPendingRef.current = true;
    setRequestingMicrophone(true);
    setVoiceStatus("Requesting microphone permission…");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      setVoiceStatus(microphonePermissionMessage(error));
      return;
    } finally {
      microphoneRequestPendingRef.current = false;
      setRequestingMicrophone(false);
    }
    stream.getTracks().forEach((track) => track.stop());

    if (requestId !== voiceRequestSequenceRef.current || !active) return;

    const recognition = new Recognition();
    let hasTranscript = false;
    let hasError = false;
    recognition.lang = speechLanguage();
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript: string[] = [];
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result?.isFinal && result[0]) transcript.push(result[0].transcript);
      }
      if (transcript.length > 0) {
        hasTranscript = true;
        const spokenText = transcript.join(" ").trim();
        setInput((current) =>
          `${current.trimEnd()}${current.trim() ? " " : ""}${spokenText}`.slice(0, 2000),
        );
        setVoiceStatus("Speech added to your message. Review it before sending.");
      }
    };
    recognition.onerror = (event) => {
      hasError = true;
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
        setIsListening(false);
      }
      // The error code only (never audio or text), to help diagnose browser support.
      console.info(`[voice] speech recognition error: ${event.error}`);
      setVoiceStatus(speechErrorMessage(event.error));
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
        setIsListening(false);
      }
      if (!hasTranscript && !hasError) {
        setVoiceStatus("No speech was recognized. Try again or type your message.");
      }
    };

    recognitionRef.current = recognition;
    setVoiceStatus("Listening… Your browser handles speech recognition. Review the text before sending.");
    setIsListening(true);
    try {
      recognition.start();
    } catch (error) {
      recognitionRef.current = null;
      setIsListening(false);
      if (!(error instanceof DOMException)) throw error;
      setVoiceStatus("Voice input could not start. Check microphone access or type your message instead.");
    }
  }

  const popup = variant === "popup";
  const activeConversationId = experience.activeConversation?.id ?? null;

  if (!experience.ready) {
    return (
      <div role="status" className="flex min-h-48 flex-1 items-center justify-center text-sm text-slate-500">
        Loading saved conversations…
      </div>
    );
  }

  const chat = (
    <div className={`relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border shadow-xl ${
      dark ? "border-[#35443a] bg-[#17241d] text-[#f5f2e8]" : "border-[#dfe3d6] bg-[#fffdf8] text-[#24352d]"
    } ${popup ? "h-full" : "min-h-[70vh]"}`}>
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close conversation history"
          onClick={() => setSidebarOpen(false)}
          className="absolute inset-0 z-20 bg-black/35"
        />
      )}
      <aside
        aria-label="Conversation history"
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
        className={`absolute inset-y-0 left-0 z-30 flex w-[min(19rem,88%)] flex-col border-r p-4 shadow-2xl transition-transform duration-200 motion-reduce:transition-none ${
          dark ? "border-[#35443a] bg-[#1f2c24]" : "border-[#e4e0d5] bg-[#fbfaf5]"
        } ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Your chats</h2>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close conversation history"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#bd7e3e]"
          >
            <CloseIcon />
          </button>
        </div>
        <button
          type="button"
          onClick={() => { startOver(); setSidebarOpen(false); }}
          className="mt-4 flex min-h-11 items-center gap-3 rounded-xl border border-[#bdc8bb] px-3 text-sm font-semibold hover:bg-[#eff1e9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#bd7e3e]"
        >
          <PlusIcon /> New chat
        </button>
        <label htmlFor={`${messageInputId}-search`} className="sr-only">Search saved chats</label>
        <input
          id={`${messageInputId}-search`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search chats"
          className={`mt-4 min-h-10 rounded-xl border px-3 text-sm outline-none focus:ring-2 focus:ring-[#bd7e3e] ${
            dark ? "border-[#49574d] bg-[#17241d] text-white placeholder:text-slate-400" : "border-[#d7d9d0] bg-white text-slate-900"
          }`}
        />
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Saved in this browser only. Removing a chat here does not delete server records.
        </p>
        <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="px-2 py-4 text-sm text-slate-500">
              {search ? "No chats match your search." : "Your saved chats will appear here."}
            </p>
          ) : conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`rounded-xl p-2 ${
                activeConversationId === conversation.id
                  ? dark ? "bg-[#35443a]" : "bg-[#e9ede4]"
                  : "hover:bg-black/5"
              }`}
            >
              {renameId === conversation.id ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    experience.renameConversation(conversation.id, renameValue);
                    setRenameId(null);
                  }}
                  className="flex gap-2"
                >
                  <input
                    autoFocus
                    aria-label="Chat name"
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    maxLength={80}
                    className="min-w-0 flex-1 rounded-lg border border-[#bdc8bb] px-2 py-1 text-sm text-slate-950"
                  />
                  <button type="submit" className="rounded-lg px-2 text-sm font-semibold">Save</button>
                </form>
              ) : deleteId === conversation.id ? (
                <div>
                  <p className="text-xs">Remove this chat from this browser?</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => { experience.deleteConversation(conversation.id); setDeleteId(null); }}
                      className="rounded-lg bg-[#8b3c2f] px-2 py-1 text-xs font-semibold text-white"
                    >
                      Remove
                    </button>
                    <button type="button" onClick={() => setDeleteId(null)} className="rounded-lg px-2 py-1 text-xs">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-1">
                  <button
                    type="button"
                    onClick={() => { experience.selectConversation(conversation.id); setSidebarOpen(false); }}
                    className="min-w-0 flex-1 truncate rounded-lg px-2 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#bd7e3e]"
                    aria-pressed={activeConversationId === conversation.id}
                  >
                    {conversation.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRenameId(conversation.id); setRenameValue(conversation.title); }}
                    aria-label={`Rename ${conversation.title}`}
                    title="Rename chat"
                    className="h-9 w-9 shrink-0 rounded-lg text-xs hover:bg-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#bd7e3e]"
                  >
                    <PencilIcon />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(conversation.id)}
                    aria-label={`Remove ${conversation.title} from this browser`}
                    title="Remove from this browser"
                    className="h-9 w-9 shrink-0 rounded-lg text-xs hover:bg-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#bd7e3e]"
                  >
                    <TrashIcon />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      <section className="flex min-h-0 flex-1 flex-col" inert={sidebarOpen}>
        <header className={`flex shrink-0 items-center justify-between gap-2 border-b px-3 py-3 sm:px-5 ${
          dark ? "border-[#35443a]" : "border-[#e7e4da]"
        }`}>
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label="Open conversation history"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#bd7e3e]"
            >
              <MenuIcon />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {experience.activeConversation?.title ?? "New conversation"}
              </p>
              <p className="text-xs text-slate-500">Educational information · synthetic demo</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close assistant chat"
                title="Close assistant chat"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#bd7e3e]"
              >
                <CloseIcon />
              </button>
            )}
            <button
              type="button"
              onClick={startOver}
              aria-label="Start a new chat"
              title="Start a new chat"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#254a38] text-white hover:bg-[#1d3d2e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#bd7e3e]"
            >
              <PlusIcon />
            </button>
          </div>
        </header>

        {experience.storageMessage && (
          <p role="status" className="shrink-0 border-b border-[#dec9a8] bg-[#f5ead9] px-4 py-2 text-xs text-[#654a2e]">
            {experience.storageMessage}
          </p>
        )}

        <div
          aria-live="polite"
          className={`min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-5 sm:px-6 ${
            dark ? "bg-[#17241d]" : "bg-[#fffdf8]"
          }`}
        >
          {messages.length === 0 ? (
            <div className="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center py-10 text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#e8ede2] text-[#254a38]">
                <ChatSparkIcon />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">What would you like to discuss?</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
                Share one concern at a time. MediMate may ask follow-up questions and use relevant synthetic health history.
              </p>
            </div>
          ) : messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              priorUserTexts={messages.slice(0, index).filter((m) => m.role === "user").map((m) => m.content)}
              dark={dark}
              onFeedback={experience.setFeedback}
              onCopy={async (content) => {
                try {
                  await navigator.clipboard.writeText(content);
                  setCopyStatus("Response copied.");
                } catch {
                  setCopyStatus("Copy is unavailable in this browser.");
                }
              }}
            />
          ))}
          {loading && (
            <p role="status" className="flex items-center gap-3 text-sm text-slate-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#bd7e3e]" />
              MediMate is preparing a response…
            </p>
          )}
        </div>

        {latestResponse?.status === "follow_up" && (
          <div className={`shrink-0 border-t px-3 py-3 sm:px-5 ${dark ? "border-[#35443a]" : "border-[#e7e4da]"}`}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Follow-up prompts</p>
            <div className="flex flex-wrap gap-2">
              {latestResponse.followUpQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => selectFollowUpQuestion(question)}
                  disabled={loading}
                  className="max-w-full min-w-0 rounded-xl border border-[#bdc8bb] px-3 py-2 text-left text-xs leading-5 break-words hover:bg-[#eff1e9] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#bd7e3e]"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {experience.signInRequired && (
          <div
            role="status"
            className={`shrink-0 border-t px-4 py-4 text-sm ${
              dark ? "border-[#35443a] bg-[#25342b] text-[#f4f1e7]" : "border-[#e7e4da] bg-[#eef0e5] text-[#24352d]"
            }`}
          >
            <h2 className="font-semibold">Sign in to chat with MediMate</h2>
            <p className="mt-1">Your health history stays private to your account.</p>
            <a
              href={signInHref}
              className="mt-3 inline-flex min-h-10 items-center justify-center rounded-full bg-[#254a38] px-4 py-2 font-semibold text-white hover:bg-[#1d3d2e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd7e3e]"
            >
              Continue with Google
            </a>
          </div>
        )}

        {errorMessage && !experience.signInRequired && (
          <div role="alert" className="shrink-0 border-t border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            <p>{errorMessage}</p>
            {retryAvailable && (
              <button
                type="button"
                onClick={() => void experience.retry()}
                disabled={loading}
                className="mt-2 rounded-lg bg-red-800 px-3 py-2 text-xs font-semibold text-white hover:bg-red-900 disabled:opacity-60"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {copyStatus && <p role="status" className="sr-only">{copyStatus}</p>}

        <form
          onSubmit={(event) => { event.preventDefault(); void submitMessage(); }}
          className={`shrink-0 border-t p-3 sm:p-5 ${dark ? "border-[#35443a] bg-[#1f2c24]" : "border-[#e7e4da] bg-[#fbfaf5]"}`}
        >
          <label htmlFor={messageInputId} className="sr-only">Message</label>
          <div className={`flex items-end gap-2 rounded-2xl border p-2 shadow-sm ${
            dark ? "border-[#49574d] bg-[#17241d]" : "border-[#d7d9d0] bg-white"
          }`}>
            <textarea
              id={messageInputId}
              ref={messageInputRef}
              rows={2}
              maxLength={2000}
              value={input}
              onChange={(event) => { setInput(event.target.value); setCopyStatus(null); }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submitMessage();
                }
              }}
              placeholder="Message MediMate…"
              disabled={loading}
              className={`min-h-12 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none ${
                dark ? "text-white placeholder:text-slate-400" : "text-slate-950 placeholder:text-slate-400"
              }`}
            />
            <button
              type="button"
              onClick={() => void toggleVoiceInput()}
              disabled={loading || requestingMicrophone}
              aria-label={requestingMicrophone ? "Requesting microphone permission" : isListening ? "Stop voice input" : "Start voice input"}
              aria-pressed={isListening}
              title={requestingMicrophone ? "Requesting microphone permission" : isListening ? "Stop voice input" : "Start voice input"}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-black/5 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#bd7e3e]"
            >
              {isListening ? <StopIcon /> : <MicrophoneIcon />}
            </button>
            <button
              type="submit"
              aria-label={loading ? "Sending message" : "Send message"}
              title={loading ? "Sending message" : "Send message"}
              disabled={loading || input.trim().length === 0 || (
                retryAvailable
                && messages[messages.length - 1]?.role === "user"
                && messages[messages.length - 1]?.content === input.trim()
              )}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#254a38] text-white hover:bg-[#1d3d2e] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#bd7e3e]"
            >
              <SendIcon />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>{voiceStatus ?? "Synthetic demo only · do not enter real health information."}</span>
            <span>{input.length}/2000</span>
          </div>
        </form>
      </section>
    </div>
  );

  if (popup) return chat;
  return <AssistantPageLayout messages={messages}>{chat}</AssistantPageLayout>;
}

function AssistantPageLayout({
  messages,
  children,
}: {
  messages: readonly AssistantChatMessage[];
  children: ReactNode;
}) {
  const [mobileView, setMobileView] = useState<"chat" | "history">("chat");
  const latestAssessment =
    [...messages].reverse().find((message) => message.response?.assessment)?.response?.assessment ?? null;
  const records = latestAssessment?.historyConsidered ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Assistant view" className="flex rounded-full bg-[#eeece1] p-1 lg:hidden">
        {(["chat", "history"] as const).map((view) => (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={mobileView === view}
            onClick={() => setMobileView(view)}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c98b48] ${
              mobileView === view ? "bg-[#254a38] text-[#fbfaf5]" : "text-[#40564a]"
            }`}
          >
            {view === "chat" ? "Chat" : `History used · ${records.length}`}
          </button>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className={`min-w-0 flex-col ${mobileView === "chat" ? "flex" : "hidden lg:flex"}`}>{children}</div>
        <aside
          aria-labelledby="history-used-heading"
          className={`h-fit flex-col gap-3 rounded-3xl border border-[#dfe3d6] bg-[#fffdf8] p-5 lg:sticky lg:top-6 ${
            mobileView === "history" ? "flex" : "hidden lg:flex"
          }`}
        >
          <p className="landing-kicker">History used</p>
          <h2 id="history-used-heading" className="text-lg font-semibold text-[#243b30]">
            {records.length > 0
              ? `${records.length} ${records.length === 1 ? "record" : "records"} informed the latest answer`
              : "No records used yet"}
          </h2>
          {records.length === 0 ? (
            <p className="text-sm leading-6 text-[#5b6b61]">
              When MediMate gives an educational assessment, the dated logs it retrieved for your concern appear here.
              If none are relevant, it says so instead of guessing.
            </p>
          ) : (
            <ol className="space-y-2.5">
              {records.map((record) => (
                <li key={record.logId} className="rounded-2xl border border-[#dfe3d6] bg-[#f7f5ed] px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8a6a47]">
                    Log · <time dateTime={record.date}>{record.date}</time>
                    {record.cited ? " · cited" : ""}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#24352d]">{record.observation}</p>
                  {record.reason === "recent_measurement" && (
                    <p className="mt-1 text-xs text-[#6b776f]">Recent measurement</p>
                  )}
                </li>
              ))}
            </ol>
          )}
          <p className="rounded-2xl border border-[#e6cfa9] bg-[#f5ead9] px-4 py-3 text-xs leading-5 text-[#654a2e]">
            Records are your own user-reported logs. Links between them and your concern are possible associations, not causes.
          </p>
        </aside>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  priorUserTexts,
  dark,
  onFeedback,
  onCopy,
}: {
  message: AssistantChatMessage;
  /** The user's own messages before this reply (used only to prefill "Save to my log"). */
  priorUserTexts: readonly string[];
  dark: boolean;
  onFeedback: (messageId: string, feedback: "helpful" | "not-helpful") => void;
  onCopy: (content: string) => void;
}) {
  const isUser = message.role === "user";
  const isUrgent = message.response?.status === "urgent";
  const promptSafetyMessage =
    message.response?.safety.level === "prompt" ? message.response.safety.message : null;
  return (
    <article className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      {!isUser && promptSafetyMessage && (
        <aside
          role="status"
          className={`mb-3 max-w-[92%] rounded-xl border px-4 py-3 text-sm leading-6 sm:max-w-[85%] ${
            dark
              ? "border-amber-700 bg-amber-950 text-amber-100"
              : "border-amber-300 bg-amber-50 text-amber-950"
          }`}
        >
          <h2 className="font-semibold">Contact a GP or NHS 111 today</h2>
          <p className="mt-1">{promptSafetyMessage}</p>
        </aside>
      )}
      {!isUrgent && (
        <div
          className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[85%] ${
            isUser
              ? "rounded-br-md bg-[#254a38] text-white"
              : dark ? "rounded-bl-md bg-[#26372c] text-slate-100" : "rounded-bl-md bg-[#f1f0e9] text-[#24352d]"
          }`}
        >
          <MarkdownMessage content={message.content} />
        </div>
      )}
      {!isUser && (
        <div className="mt-1 flex items-center gap-1">
          <button
            type="button"
            onClick={() => onCopy(message.content)}
            aria-label="Copy response"
            title="Copy response"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#bd7e3e]"
          >
            <Icon name="copy" />
          </button>
          {message.response && (
            <>
              <button
                type="button"
                onClick={() => onFeedback(message.id, "helpful")}
                aria-label="Mark response helpful"
                aria-pressed={message.feedback === "helpful"}
                title="Helpful"
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#bd7e3e] ${
                  message.feedback === "helpful" ? "text-[#276847]" : "text-slate-500"
                }`}
              >
                <Icon name="thumbs-up" />
              </button>
              <button
                type="button"
                onClick={() => onFeedback(message.id, "not-helpful")}
                aria-label="Mark response not helpful"
                aria-pressed={message.feedback === "not-helpful"}
                title="Not helpful"
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#bd7e3e] ${
                  message.feedback === "not-helpful" ? "text-[#8b3c2f]" : "text-slate-500"
                }`}
              >
                <Icon name="thumbs-down" />
              </button>
            </>
          )}
        </div>
      )}
      {!isUser && message.response && (
        <div className="mt-3 w-full max-w-3xl">
          <AssistantResult response={message.response} dark={dark} />
        </div>
      )}
      {!isUser && message.response?.status === "assessment" && priorUserTexts.length > 0 && (
        <div className="mt-3 w-full max-w-3xl">
          <SaveToLog userTexts={priorUserTexts} dark={dark} />
        </div>
      )}
    </article>
  );
}

function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(<p key={`p-${blocks.length}`}>{renderInline(paragraph.join(" "))}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc space-y-1 pl-5">
        {list.map((item, index) => <li key={`${blocks.length}-${index}`}>{renderInline(item)}</li>)}
      </ul>,
    );
    list = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const fence = line.match(/^```([a-z0-9+#.-]{0,24})\s*$/i);
    if (fence) {
      flushParagraph();
      flushList();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index] ?? "")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      blocks.push(
        <div key={`code-${blocks.length}`} className="overflow-hidden rounded-xl border border-slate-700 bg-[#17211b] text-slate-100">
          {fence[1] && <p className="border-b border-slate-700 px-3 py-1 text-[10px] uppercase tracking-wide text-slate-400">{fence[1]}</p>}
          <pre className="overflow-x-auto p-4 text-xs leading-5"><code>{codeLines.join("\n")}</code></pre>
        </div>,
      );
      continue;
    }

    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push(<h3 key={`h-${blocks.length}`} className="text-base font-semibold">{renderInline(heading[1] ?? "")}</h3>);
    } else if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph();
      list.push(line.replace(/^\s*[-*]\s+/, ""));
    } else if (!line.trim()) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();

  return <div className="space-y-3 break-words">{blocks}</div>;
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.9em]">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

type IconName =
  | "menu" | "plus" | "close" | "pencil" | "trash"
  | "chat" | "microphone" | "stop" | "send" | "copy" | "thumbs-up" | "thumbs-down";

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    pencil: <><path d="m4 16.5-.8 4.3 4.3-.8L20 7.5 16.5 4 4 16.5Z" /><path d="m14.5 6 3.5 3.5" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
    chat: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2 1-4a7.5 7.5 0 1 1 16-5.5Z" /><path d="M8 11h.01M12 11h.01M16 11h.01" /></>,
    microphone: <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3m-4 0h8" /></>,
    stop: <><rect x="6" y="6" width="12" height="12" rx="2" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    "thumbs-up": <><path d="M7 10v11H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3Zm0 0 5-8c2 0 3 2 2 4l-1 4h6a2 2 0 0 1 2 2l-1 7a2 2 0 0 1-2 2H7" /></>,
    "thumbs-down": <><path d="M7 14V3H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3Zm0 0 5 8c2 0 3-2 2-4l-1-4h6a2 2 0 0 0 2-2l-1-7a2 2 0 0 0-2-2H7" /></>,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function MenuIcon() { return <Icon name="menu" />; }
function PlusIcon() { return <Icon name="plus" />; }
function CloseIcon() { return <Icon name="close" />; }
function PencilIcon() { return <Icon name="pencil" />; }
function TrashIcon() { return <Icon name="trash" />; }
function ChatSparkIcon() { return <Icon name="chat" />; }
function MicrophoneIcon() { return <Icon name="microphone" />; }
function StopIcon() { return <Icon name="stop" />; }
function SendIcon() { return <Icon name="send" />; }

function AssistantResult({ response, dark = false }: { response: ChatResponse | null; dark?: boolean }) {
  if (!response) {
    return (
      <aside className={`rounded-xl border border-dashed p-6 text-sm ${dark ? "border-slate-600 text-slate-300" : "border-slate-300 text-slate-600"}`}>
        Your follow-up questions and educational assessment will appear here.
      </aside>
    );
  }

  if (response.status === "urgent") {
    return (
      <aside
        role="alert"
        className={`h-fit rounded-xl border-2 border-red-600 p-6 shadow-sm ${dark ? "bg-red-950 text-red-50" : "bg-red-50 text-red-950"}`}
      >
        <p className="text-sm font-bold uppercase tracking-wide">Urgent safety guidance</p>
        <h2 className="mt-2 text-xl font-semibold">Please seek professional help</h2>
        <p className="mt-3">{response.safety.message}</p>
        <p className="mt-4 text-sm">{response.assistantMessage}</p>
      </aside>
    );
  }

  if (response.status === "follow_up") {
    return (
      <aside className={`h-fit rounded-xl border p-6 ${dark ? "border-[#35443a] bg-[#1f2c24] text-[#eef0e5]" : "border-[#dfe3d6] bg-[#f3f4ec] text-[#24352d]"}`}>
        <h2 className="text-xl font-semibold">More information needed</h2>
        <p className="mt-2 text-sm">
          The assistant is asking focused questions before offering an educational summary.
        </p>
      </aside>
    );
  }

  const assessment = response.assessment;
  if (!assessment) return null;

  return (
    <aside className={`h-fit space-y-5 rounded-xl border p-5 shadow-sm sm:p-6 ${
      dark ? "border-[#35443a] bg-[#1f2c24] text-slate-100" : "border-slate-200 bg-white text-slate-950"
    }`}>
      <div>
        <p className={`text-sm font-medium ${dark ? "text-[#d9c99f]" : "text-[#254a38]"}`}>Educational assessment</p>
        <h2 className="mt-1 text-xl font-semibold">Assessment</h2>
      </div>

      <GroundedAssessment assessment={assessment} dark={dark} />
    </aside>
  );
}
