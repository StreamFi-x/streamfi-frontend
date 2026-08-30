import type { ClipCollaborator, ClipCollaboratorRole } from "./types";
import { collaboratorStore } from "./seedData";

export const MAX_COLLABORATORS_PER_CLIP = 5;

export class CollaboratorCapExceededError extends Error {}

function getClipMap(clipId: string): Map<string, ClipCollaborator> {
  let clipMap = collaboratorStore.get(clipId);
  if (!clipMap) {
    clipMap = new Map();
    collaboratorStore.set(clipId, clipMap);
  }
  return clipMap;
}

export function addCollaborator(input: {
  clip_id: string;
  collaborator_id: string;
  role: ClipCollaboratorRole;
}): ClipCollaborator {
  const clipMap = getClipMap(input.clip_id);

  const existing = clipMap.get(input.collaborator_id);
  if (!existing && clipMap.size >= MAX_COLLABORATORS_PER_CLIP) {
    throw new CollaboratorCapExceededError(
      `clip '${input.clip_id}' already has the maximum of ${MAX_COLLABORATORS_PER_CLIP} collaborators`
    );
  }

  const collaborator: ClipCollaborator = {
    clip_id: input.clip_id,
    collaborator_id: input.collaborator_id,
    role: input.role,
    added_at: new Date().toISOString(),
  };

  clipMap.set(input.collaborator_id, collaborator);
  return collaborator;
}

export function removeCollaborator(
  clipId: string,
  collaboratorId: string
): boolean {
  const clipMap = collaboratorStore.get(clipId);
  if (!clipMap) {return false;}
  return clipMap.delete(collaboratorId);
}

export function listCollaborators(clipId: string): ClipCollaborator[] {
  const clipMap = collaboratorStore.get(clipId);
  if (!clipMap) {return [];}
  return Array.from(clipMap.values()).sort(
    (a, b) => new Date(a.added_at).getTime() - new Date(b.added_at).getTime()
  );
}
