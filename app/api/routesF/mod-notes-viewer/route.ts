import { NextResponse } from 'next/server';
import { createNote, deleteNote, getNotes, updateNote } from './helpers';
import {
  ModNoteCreateRequest,
  ModNoteCreateResponse,
  ModNoteListResponse,
  ModNoteDeleteResponse,
  ModNoteUpdateRequest,
  ModNoteUpdateResponse,
} from './types';

export async function POST(request: Request): Promise<
  NextResponse<ModNoteCreateResponse | ModNoteUpdateResponse | { error: string }>
> {
  try {
    const body = await request.json();
    const { creator_id, viewer_id, mod_id, note, note_id } = body;

    // Handle update if note_id is provided
    if (note_id) {
      if (!creator_id || !viewer_id || !mod_id || !note) {
        return NextResponse.json(
          { error: 'Missing required fields for update: creator_id, viewer_id, mod_id, note' },
          { status: 400 }
        );
      }
      const result = updateNote(creator_id, viewer_id, note_id, note);
      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Update failed' }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        updated_at: result.note?.updated_at || 0,
      });
    }

    // Handle create
    if (!creator_id || !viewer_id || !mod_id || !note) {
      return NextResponse.json(
        { error: 'Missing required fields: creator_id, viewer_id, mod_id, note' },
        { status: 400 }
      );
    }

    const result = createNote(creator_id, viewer_id, mod_id, note);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Creation failed' }, { status: 400 });
    }

    const response: ModNoteCreateResponse = {
      id: result.note!.id,
      success: true,
      created_at: result.note!.created_at,
    };
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body or processing error' }, { status: 400 });
  }
}

export async function GET(request: Request): Promise<NextResponse<ModNoteListResponse | { error: string }>> {
  try {
    const url = new URL(request.url);
    const creator_id = url.searchParams.get('creator_id');
    const viewer_id = url.searchParams.get('viewer_id');

    if (!creator_id || !viewer_id) {
      return NextResponse.json(
        { error: 'Missing required query parameters: creator_id, viewer_id' },
        { status: 400 }
      );
    }

    const notes = getNotes(creator_id, viewer_id);
    const response: ModNoteListResponse = {
      notes,
      total: notes.length,
    };
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: 'Processing error' }, { status: 400 });
  }
}

export async function DELETE(request: Request): Promise<NextResponse<ModNoteDeleteResponse | { error: string }>> {
  try {
    const url = new URL(request.url);
    const creator_id = url.searchParams.get('creator_id');
    const viewer_id = url.searchParams.get('viewer_id');
    const note_id = url.searchParams.get('note_id');

    if (!creator_id || !viewer_id || !note_id) {
      return NextResponse.json(
        { error: 'Missing required query parameters: creator_id, viewer_id, note_id' },
        { status: 400 }
      );
    }

    const success = deleteNote(creator_id, viewer_id, note_id);
    if (!success) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const response: ModNoteDeleteResponse = { success: true };
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: 'Processing error' }, { status: 400 });
  }
}
