import "server-only";

// Data access for the assistant: demo profile, recent logs, chat sessions and
// messages. Every query is scoped to DEMO_PROFILE_ID (RLS enforces it too).
import type { Assessment, HealthLog, Profile, SafetyLevel } from "@/lib/validations";
import { DEMO_PROFILE_ID } from "@/lib/validations";

import type { ChatMessage } from "@/lib/ai/types";
import {
  HEALTH_LOG_COLUMNS,
  PROFILE_COLUMNS,
  firstRow,
  rowToHealthLog,
  rowToProfile,
} from "./mappers";
import { supabaseRest } from "./server";

export const MAX_CONTEXT_MESSAGES = 12;

export async function getDemoProfile(): Promise<Profile | null> {
  const row = firstRow(
    await supabaseRest(`profiles?select=${PROFILE_COLUMNS}&id=eq.${DEMO_PROFILE_ID}&limit=1`),
  );
  return row === undefined ? null : rowToProfile(row);
}

export async function listRecentLogs(windowDays: number, limit: number): Promise<HealthLog[]> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const rows = await supabaseRest(
    `health_logs?select=${HEALTH_LOG_COLUMNS}&profile_id=eq.${DEMO_PROFILE_ID}` +
      `&logged_at=gte.${encodeURIComponent(since)}&order=logged_at.desc&limit=${limit}`,
  );
  if (!Array.isArray(rows)) throw new Error("Unexpected health_logs response shape");
  return rows.map(rowToHealthLog);
}

/** True if the session exists and belongs to the demo profile. */
export async function sessionExists(sessionId: string): Promise<boolean> {
  const rows = await supabaseRest(
    `symptom_sessions?select=id&id=eq.${sessionId}&profile_id=eq.${DEMO_PROFILE_ID}&limit=1`,
  );
  return firstRow(rows) !== undefined;
}

const messageRowSchemaCheck = (row: unknown): row is ChatMessage =>
  !!row &&
  typeof row === "object" &&
  "role" in row &&
  (row.role === "user" || row.role === "assistant") &&
  "content" in row &&
  typeof row.content === "string";

/** The most recent messages of a session, oldest first. */
export async function listRecentMessages(sessionId: string): Promise<ChatMessage[]> {
  const rows = await supabaseRest(
    `symptom_messages?select=role,content&session_id=eq.${sessionId}` +
      `&order=created_at.desc,id.desc&limit=${MAX_CONTEXT_MESSAGES}`,
  );
  if (!Array.isArray(rows)) throw new Error("Unexpected symptom_messages response shape");
  return rows.filter(messageRowSchemaCheck).map(({ role, content }) => ({ role, content })).reverse();
}

export async function createSession(initialSymptom: string): Promise<string> {
  const row = firstRow(
    await supabaseRest("symptom_sessions?select=id", {
      method: "POST",
      body: { profile_id: DEMO_PROFILE_ID, initial_symptom: initialSymptom },
      returnRepresentation: true,
    }),
  );
  if (!row || typeof row !== "object" || !("id" in row) || typeof row.id !== "string") {
    throw new Error("Session insert returned no id");
  }
  return row.id;
}

/** Inserts the user message then the assistant reply, with explicit increasing timestamps. */
export async function appendTurn(sessionId: string, userText: string, assistantText: string): Promise<void> {
  const now = Date.now();
  await supabaseRest("symptom_messages", {
    method: "POST",
    body: [
      { session_id: sessionId, role: "user", content: userText, created_at: new Date(now).toISOString() },
      { session_id: sessionId, role: "assistant", content: assistantText, created_at: new Date(now + 1).toISOString() },
    ],
  });
}

export async function completeSession(
  sessionId: string,
  assessment: Assessment | null,
  urgencyLevel: SafetyLevel,
): Promise<void> {
  await supabaseRest(`symptom_sessions?id=eq.${sessionId}&profile_id=eq.${DEMO_PROFILE_ID}`, {
    method: "PATCH",
    body: {
      status: "completed",
      assessment,
      urgency_level: urgencyLevel,
      updated_at: new Date().toISOString(),
    },
  });
}
