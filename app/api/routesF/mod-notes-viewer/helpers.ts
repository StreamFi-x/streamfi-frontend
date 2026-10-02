import { ModNote } from './types';

const MAX_NOTES_PER_VIEWER = 50;

// In-memory store for mod notes
// Key: creator_id:viewer_id, Value: array of notes
const MOD_NOTES_STORE = new Map<string, ModNote[]>();
let NOTE_ID_COUNTER = 1;

function getStoreKey(creatorId: string, viewerId: string): string {
  return `${creatorId}:${viewerId}`;
}

export function createNote(
  creatorId: string,
  viewerId: string,
  modId: string,
  note: string
): { success: boolean; note: ModNote | null; error?: string } {
  const key = getStoreKey(creatorId, viewerId);
  const notes = MOD_NOTES_STORE.get(key) || [];

  if (notes.length >= MAX_NOTES_PER_VIEWER) {
    return {
      success: false,
      note: null,
      error: `Maximum ${MAX_NOTES_PER_VIEWER} notes per viewer exceeded`,
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const newNote: ModNote = {
    id: `note_${NOTE_ID_COUNTER++}`,
    creator_id: creatorId,
    viewer_id: viewerId,
    mod_id: modId,
    note,
    created_at: now,
    updated_at: now,
  };

  notes.push(newNote);
  MOD_NOTES_STORE.set(key, notes);

  return { success: true, note: newNote };
}

export function getNotes(creatorId: string, viewerId: string): ModNote[] {
  const key = getStoreKey(creatorId, viewerId);
  return MOD_NOTES_STORE.get(key) || [];
}

export function deleteNote(creatorId: string, viewerId: string, noteId: string): boolean {
  const key = getStoreKey(creatorId, viewerId);
  const notes = MOD_NOTES_STORE.get(key);

  if (!notes) {
    return false;
  }

  const initialLength = notes.length;
  const filtered = notes.filter((n) => n.id !== noteId);

  if (filtered.length === initialLength) {
    return false; // Note not found
  }

  if (filtered.length === 0) {
    MOD_NOTES_STORE.delete(key);
  } else {
    MOD_NOTES_STORE.set(key, filtered);
  }

  return true;
}

export function updateNote(
  creatorId: string,
  viewerId: string,
  noteId: string,
  newNote: string
): { success: boolean; note?: ModNote; error?: string } {
  const key = getStoreKey(creatorId, viewerId);
  const notes = MOD_NOTES_STORE.get(key);

  if (!notes) {
    return { success: false, error: 'Notes for this viewer not found' };
  }

  const noteToUpdate = notes.find((n) => n.id === noteId);
  if (!noteToUpdate) {
    return { success: false, error: 'Note not found' };
  }

  noteToUpdate.note = newNote;
  noteToUpdate.updated_at = Math.floor(Date.now() / 1000);

  return { success: true, note: noteToUpdate };
}

// For testing: clear all notes
export function clearAllNotes(): void {
  MOD_NOTES_STORE.clear();
  NOTE_ID_COUNTER = 1;
}
