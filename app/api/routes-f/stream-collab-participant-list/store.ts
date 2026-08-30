import type { CollabSession } from "./types";
import { collabSessionStore } from "./seedData";

export class SessionNotFoundError extends Error {}

export function getSession(collabSessionId: string): CollabSession {
  const session = collabSessionStore.get(collabSessionId);
  if (!session) {
    throw new SessionNotFoundError(
      `collab session '${collabSessionId}' not found`
    );
  }
  return session;
}
