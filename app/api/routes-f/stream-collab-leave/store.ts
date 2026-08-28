import type { CollabSession } from "./types";
import { collabSessionStore } from "./seedData";

export class SessionNotFoundError extends Error {}
export class SessionNotActiveError extends Error {}
export class NotAParticipantError extends Error {}

/**
 * Removes `creatorId` from the session's participant list.
 *
 * - If the host leaves, the session ends immediately for every remaining
 *   participant — this route doesn't implement host-promotion, so ending
 *   the session is the only way to avoid leaving guests in a session with
 *   no host. A future issue can add promotion if that's the desired UX.
 * - If the last remaining participant (of any role) leaves, the session
 *   also ends, since a "collab" session with zero participants is
 *   meaningless.
 * - Otherwise (a guest leaves and the host + other guests remain), the
 *   session stays active with the departing participant removed.
 */
export function leaveSession(
  collabSessionId: string,
  creatorId: string
): CollabSession {
  const session = collabSessionStore.get(collabSessionId);
  if (!session) {
    throw new SessionNotFoundError(
      `collab session '${collabSessionId}' not found`
    );
  }
  if (session.status !== "active") {
    throw new SessionNotActiveError(
      `collab session '${collabSessionId}' is not active`
    );
  }

  const leaving = session.participants.find(p => p.creator_id === creatorId);
  if (!leaving) {
    throw new NotAParticipantError(
      `creator '${creatorId}' is not a participant of session '${collabSessionId}'`
    );
  }

  const remaining = session.participants.filter(
    p => p.creator_id !== creatorId
  );
  const sessionEnds = leaving.role === "host" || remaining.length === 0;

  // Ending participants: the remaining roster is kept (not cleared) so a
  // client can still show "who was in this session" after it ends — only
  // the leaving participant is ever removed from the list.
  const updated: CollabSession = {
    ...session,
    status: sessionEnds ? "ended" : "active",
    participants: remaining,
  };
  collabSessionStore.set(collabSessionId, updated);

  return updated;
}
