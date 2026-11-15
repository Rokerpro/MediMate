"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { z } from "zod";
import { ASSISTANT_STORAGE_KEY, ApiClientError, sendAssistantMessage } from "@/lib/api-client";
import { chatResponseSchema, type ChatResponse } from "@/lib/validations";

const STORAGE_KEY = ASSISTANT_STORAGE_KEY;

const chatMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  response: chatResponseSchema.optional(),
  feedback: z.enum(["helpful", "not-helpful"]).nullable().optional(),
});

const conversationSchema = z.object({
  id: z.string().min(1),
  sessionId: z.uuid().nullable(),
  title: z.string().min(1).max(80),
  createdAt: z.string(),
  updatedAt: z.string(),
  messages: z.array(chatMessageSchema),
});

const experienceSchema = z.object({
  conversations: z.array(conversationSchema),
  activeConversationId: z.string().nullable(),
  theme: z.enum(["light", "dark"]),
});

const emptyExperience: ExperienceState = {
  conversations: [],
  activeConversationId: null,
  theme: "light",
};

export type AssistantChatMessage = z.infer<typeof chatMessageSchema>;
export type AssistantConversation = z.infer<typeof conversationSchema>;
type ExperienceState = z.infer<typeof experienceSchema>;

type AssistantExperienceContextValue = {
  ready: boolean;
  conversations: AssistantConversation[];
  activeConversation: AssistantConversation | null;
  theme: "light" | "dark";
  isSending: boolean;
  errorMessage: string | null;
  retryAvailable: boolean;
  storageMessage: string | null;
  createConversation: () => void;
  selectConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;
  setFeedback: (messageId: string, feedback: "helpful" | "not-helpful") => void;
  toggleTheme: () => void;
  sendMessage: (message: string, appendUserMessage?: boolean) => Promise<boolean>;
  retry: () => Promise<boolean>;
};

const AssistantExperienceContext = createContext<AssistantExperienceContextValue | null>(null);

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createConversation(): AssistantConversation {
  const now = new Date().toISOString();
  return {
    id: createId(),
    sessionId: null,
    title: "New chat",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function loadStoredExperience(): { state: ExperienceState; message: string | null } {
  if (typeof window === "undefined") return { state: emptyExperience, message: null };
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return { state: emptyExperience, message: null };
    const parsed = experienceSchema.safeParse(JSON.parse(saved) as unknown);
    return parsed.success
      ? { state: parsed.data, message: null }
      : { state: emptyExperience, message: "Saved chats could not be read. You can start a new chat in this browser." };
  } catch {
    return { state: emptyExperience, message: "Browser storage is unavailable. Chats will last only for this visit." };
  }
}

function subscribeToHydration(): () => void {
  return () => {};
}

function getHydratedSnapshot(): boolean {
  return true;
}

function getServerHydrationSnapshot(): boolean {
  return false;
}

function titleFromMessage(message: string): string {
  const compact = message.trim().replace(/\s+/g, " ");
  return compact.length > 48 ? `${compact.slice(0, 47)}…` : compact || "New chat";
}

export function AssistantExperienceProvider({ children }: { children: ReactNode }) {
  const [initialStorage] = useState(loadStoredExperience);
  const [state, setState] = useState<ExperienceState>(initialStorage.state);
  const [storageMessage, setStorageMessage] = useState<string | null>(initialStorage.message);
  const ready = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydrationSnapshot,
  );
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryAvailable, setRetryAvailable] = useState(false);
  const [retryPrompt, setRetryPrompt] = useState<{ conversationId: string; message: string } | null>(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    if (!ready || storageMessage) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      window.setTimeout(
        () => setStorageMessage("Chats could not be saved in this browser. You can continue this conversation for now."),
        0,
      );
    }
  }, [ready, state, storageMessage]);

  const activeConversation = useMemo(
    () => state.conversations.find(({ id }) => id === state.activeConversationId) ?? null,
    [state.activeConversationId, state.conversations],
  );

  const createConversationAction = useCallback(() => {
    const conversation = createConversation();
    setState((current) => ({
      ...current,
      conversations: [conversation, ...current.conversations],
      activeConversationId: conversation.id,
    }));
    setErrorMessage(null);
    setRetryAvailable(false);
    setRetryPrompt(null);
  }, []);

  const selectConversation = useCallback((id: string) => {
    setState((current) => current.conversations.some((conversation) => conversation.id === id)
      ? { ...current, activeConversationId: id }
      : current);
    setErrorMessage(null);
    setRetryAvailable(false);
    setRetryPrompt(null);
  }, []);

  const renameConversation = useCallback((id: string, title: string) => {
    const trimmed = title.trim().slice(0, 80);
    if (!trimmed) return;
    setState((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) =>
        conversation.id === id
          ? { ...conversation, title: trimmed, updatedAt: new Date().toISOString() }
          : conversation,
      ),
    }));
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setState((current) => {
      const conversations = current.conversations.filter((conversation) => conversation.id !== id);
      return {
        ...current,
        conversations,
        activeConversationId: current.activeConversationId === id
          ? conversations[0]?.id ?? null
          : current.activeConversationId,
      };
    });
    setErrorMessage(null);
    setRetryAvailable(false);
    setRetryPrompt(null);
  }, []);

  const setFeedback = useCallback((messageId: string, feedback: "helpful" | "not-helpful") => {
    setState((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.id === messageId
            ? { ...message, feedback: message.feedback === feedback ? null : feedback }
            : message,
        ),
      })),
    }));
  }, []);

  const toggleTheme = useCallback(() => {
    setState((current) => ({ ...current, theme: current.theme === "light" ? "dark" : "light" }));
  }, []);

  const sendMessage = useCallback(async (
    message: string,
    appendUserMessage = true,
    retryConversationId?: string,
  ): Promise<boolean> => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || sendingRef.current) return false;

    const conversation = state.conversations.find(({ id }) =>
      id === (retryConversationId ?? state.activeConversationId),
    ) ?? createConversation();
    const conversationId = conversation.id;
    const existing = state.conversations.some(({ id }) => id === conversationId);
    const now = new Date().toISOString();
    const userMessage: AssistantChatMessage = {
      id: createId(),
      role: "user",
      content: trimmedMessage,
      feedback: null,
    };

    setState((current) => {
      const currentConversation = current.conversations.find(({ id }) => id === conversationId);
      const updated: AssistantConversation = currentConversation
        ? {
            ...currentConversation,
            title: currentConversation.messages.length === 0 && appendUserMessage
              ? titleFromMessage(trimmedMessage)
              : currentConversation.title,
            updatedAt: now,
            messages: appendUserMessage
              ? [...currentConversation.messages, userMessage]
              : currentConversation.messages,
          }
        : {
            ...conversation,
            title: titleFromMessage(trimmedMessage),
            messages: [userMessage],
          };
      return {
        ...current,
        conversations: existing
          ? current.conversations.map((item) => item.id === conversationId ? updated : item)
          : [updated, ...current.conversations],
        activeConversationId: conversationId,
      };
    });

    sendingRef.current = true;
    setIsSending(true);
    setErrorMessage(null);
    setRetryAvailable(false);
    try {
      const response: ChatResponse = await sendAssistantMessage({
        sessionId: conversation.sessionId,
        message: trimmedMessage,
      });
      setState((current) => ({
        ...current,
        conversations: current.conversations.map((item) => item.id === conversationId
          ? {
              ...item,
              sessionId: response.sessionId,
              updatedAt: new Date().toISOString(),
              messages: [
                ...item.messages,
                {
                  id: createId(),
                  role: "assistant",
                  content: response.assistantMessage,
                  response,
                  feedback: null,
                },
              ],
            }
          : item),
      }));
      setRetryPrompt(null);
      return true;
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) {
        setRetryPrompt(null);
      } else {
        setRetryPrompt({ conversationId, message: trimmedMessage });
      }
      setRetryAvailable(error instanceof ApiClientError && error.retryable);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The assistant is temporarily unavailable. Please try again.",
      );
      return false;
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  }, [state.activeConversationId, state.conversations]);

  const retry = useCallback(
    () => retryPrompt
      ? sendMessage(retryPrompt.message, false, retryPrompt.conversationId)
      : Promise.resolve(false),
    [retryPrompt, sendMessage],
  );

  const value = useMemo<AssistantExperienceContextValue>(() => ({
    ready,
    conversations: state.conversations,
    activeConversation,
    theme: state.theme,
    isSending,
    errorMessage,
    retryAvailable,
    storageMessage,
    createConversation: createConversationAction,
    selectConversation,
    renameConversation,
    deleteConversation,
    setFeedback,
    toggleTheme,
    sendMessage,
    retry,
  }), [
    activeConversation,
    createConversationAction,
    deleteConversation,
    errorMessage,
    isSending,
    ready,
    renameConversation,
    retry,
    retryAvailable,
    selectConversation,
    sendMessage,
    setFeedback,
    state.conversations,
    state.theme,
    storageMessage,
    toggleTheme,
  ]);

  return (
    <AssistantExperienceContext.Provider value={value}>
      {children}
    </AssistantExperienceContext.Provider>
  );
}

export function useAssistantExperience(): AssistantExperienceContextValue {
  const context = useContext(AssistantExperienceContext);
  if (!context) throw new Error("useAssistantExperience must be used within AssistantExperienceProvider.");
  return context;
}
