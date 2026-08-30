import type { ClipCollaborator } from "./types";

// Keyed by clip_id -> collaborator_id -> collaborator record.
export const collaboratorStore = new Map<string, Map<string, ClipCollaborator>>([
  [
    "clip_with_collaborators",
    new Map([
      [
        "collaborator_seed_1",
        {
          clip_id: "clip_with_collaborators",
          collaborator_id: "collaborator_seed_1",
          role: "co-host",
          added_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      [
        "collaborator_seed_2",
        {
          clip_id: "clip_with_collaborators",
          collaborator_id: "collaborator_seed_2",
          role: "editor",
          added_at: "2026-01-01T00:05:00.000Z",
        },
      ],
    ]),
  ],
]);
