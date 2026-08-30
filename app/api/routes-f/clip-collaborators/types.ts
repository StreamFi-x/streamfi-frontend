export type ClipCollaboratorRole = "co-host" | "guest" | "editor";

export const CLIP_COLLABORATOR_ROLES: ClipCollaboratorRole[] = [
  "co-host",
  "guest",
  "editor",
];

export interface ClipCollaborator {
  clip_id: string;
  collaborator_id: string;
  role: ClipCollaboratorRole;
  added_at: string;
}

export interface AddCollaboratorRequestBody {
  clip_id: string;
  collaborator_id: string;
  role: ClipCollaboratorRole;
}

export interface AddCollaboratorResponse {
  added_at: string;
}

export interface ListCollaboratorsResponse {
  clip_id: string;
  collaborators: ClipCollaborator[];
}
