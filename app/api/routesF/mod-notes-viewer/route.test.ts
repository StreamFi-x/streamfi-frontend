import { POST, GET, DELETE } from './route';
import * as helpers from './helpers';

describe('/api/routesF/mod-notes-viewer', () => {
  beforeEach(() => {
    helpers.clearAllNotes();
  });

  describe('POST - create note', () => {
    it('should create a note successfully', async () => {
      const request = new Request('http://localhost/api/routesF/mod-notes-viewer', {
        method: 'POST',
        body: JSON.stringify({
          creator_id: 'creator_123',
          viewer_id: 'viewer_456',
          mod_id: 'mod_789',
          note: 'This viewer has been warned twice this week',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.id).toBeDefined();
      expect(data.created_at).toBeDefined();
    });

    it('should return 400 for missing creator_id', async () => {
      const request = new Request('http://localhost/api/routesF/mod-notes-viewer', {
        method: 'POST',
        body: JSON.stringify({
          viewer_id: 'viewer_456',
          mod_id: 'mod_789',
          note: 'Some note',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 400 when cap of 50 notes exceeded', async () => {
      // Create 50 notes
      for (let i = 0; i < 50; i++) {
        helpers.createNote('creator_123', 'viewer_456', 'mod_789', `Note ${i}`);
      }

      // Try to create 51st note
      const request = new Request('http://localhost/api/routesF/mod-notes-viewer', {
        method: 'POST',
        body: JSON.stringify({
          creator_id: 'creator_123',
          viewer_id: 'viewer_456',
          mod_id: 'mod_789',
          note: 'This should fail',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Maximum');
    });
  });

  describe('GET - retrieve notes', () => {
    it('should return empty list for viewer with no notes', async () => {
      const request = new Request(
        'http://localhost/api/routesF/mod-notes-viewer?creator_id=creator_123&viewer_id=viewer_456',
        {
          method: 'GET',
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.notes).toEqual([]);
      expect(data.total).toBe(0);
    });

    it('should return all notes for a viewer', async () => {
      // Create multiple notes
      helpers.createNote('creator_123', 'viewer_456', 'mod_789', 'Note 1');
      helpers.createNote('creator_123', 'viewer_456', 'mod_789', 'Note 2');
      helpers.createNote('creator_123', 'viewer_456', 'mod_789', 'Note 3');

      const request = new Request(
        'http://localhost/api/routesF/mod-notes-viewer?creator_id=creator_123&viewer_id=viewer_456',
        {
          method: 'GET',
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.notes).toHaveLength(3);
      expect(data.total).toBe(3);
      expect(data.notes[0].note).toBe('Note 1');
      expect(data.notes[1].note).toBe('Note 2');
      expect(data.notes[2].note).toBe('Note 3');
    });

    it('should return 400 for missing creator_id query param', async () => {
      const request = new Request(
        'http://localhost/api/routesF/mod-notes-viewer?viewer_id=viewer_456',
        {
          method: 'GET',
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 400 for missing viewer_id query param', async () => {
      const request = new Request(
        'http://localhost/api/routesF/mod-notes-viewer?creator_id=creator_123',
        {
          method: 'GET',
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe('DELETE - remove note', () => {
    it('should delete a note successfully', async () => {
      const result = helpers.createNote('creator_123', 'viewer_456', 'mod_789', 'Note to delete');
      const noteId = result.note!.id;

      const request = new Request(
        `http://localhost/api/routesF/mod-notes-viewer?creator_id=creator_123&viewer_id=viewer_456&note_id=${noteId}`,
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify note is deleted
      const notes = helpers.getNotes('creator_123', 'viewer_456');
      expect(notes).toHaveLength(0);
    });

    it('should return 404 for non-existent note', async () => {
      const request = new Request(
        `http://localhost/api/routesF/mod-notes-viewer?creator_id=creator_123&viewer_id=viewer_456&note_id=nonexistent`,
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBeDefined();
    });

    it('should return 400 for missing note_id', async () => {
      const request = new Request(
        `http://localhost/api/routesF/mod-notes-viewer?creator_id=creator_123&viewer_id=viewer_456`,
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe('POST - update note', () => {
    it('should update an existing note', async () => {
      const result = helpers.createNote('creator_123', 'viewer_456', 'mod_789', 'Original note');
      const noteId = result.note!.id;

      const request = new Request('http://localhost/api/routesF/mod-notes-viewer', {
        method: 'POST',
        body: JSON.stringify({
          creator_id: 'creator_123',
          viewer_id: 'viewer_456',
          mod_id: 'mod_789',
          note: 'Updated note content',
          note_id: noteId,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.updated_at).toBeDefined();

      // Verify update
      const notes = helpers.getNotes('creator_123', 'viewer_456');
      expect(notes[0].note).toBe('Updated note content');
    });

    it('should return 404 for non-existent note update', async () => {
      const request = new Request('http://localhost/api/routesF/mod-notes-viewer', {
        method: 'POST',
        body: JSON.stringify({
          creator_id: 'creator_123',
          viewer_id: 'viewer_456',
          mod_id: 'mod_789',
          note: 'Updated content',
          note_id: 'nonexistent',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBeDefined();
    });
  });

  describe('CRUD workflow', () => {
    it('should handle complete create-read-update-delete workflow', async () => {
      // Create
      let request = new Request('http://localhost/api/routesF/mod-notes-viewer', {
        method: 'POST',
        body: JSON.stringify({
          creator_id: 'creator_123',
          viewer_id: 'viewer_456',
          mod_id: 'mod_789',
          note: 'Initial note',
        }),
      });

      let response = await POST(request);
      let data = await response.json();
      const noteId = data.id;

      expect(response.status).toBe(200);

      // Read
      request = new Request(
        'http://localhost/api/routesF/mod-notes-viewer?creator_id=creator_123&viewer_id=viewer_456',
        { method: 'GET' }
      );

      response = await GET(request);
      data = await response.json();
      expect(data.total).toBe(1);
      expect(data.notes[0].note).toBe('Initial note');

      // Update
      request = new Request('http://localhost/api/routesF/mod-notes-viewer', {
        method: 'POST',
        body: JSON.stringify({
          creator_id: 'creator_123',
          viewer_id: 'viewer_456',
          mod_id: 'mod_789',
          note: 'Updated note',
          note_id: noteId,
        }),
      });

      response = await POST(request);
      expect(response.status).toBe(200);

      // Read updated
      request = new Request(
        'http://localhost/api/routesF/mod-notes-viewer?creator_id=creator_123&viewer_id=viewer_456',
        { method: 'GET' }
      );

      response = await GET(request);
      data = await response.json();
      expect(data.notes[0].note).toBe('Updated note');

      // Delete
      request = new Request(
        `http://localhost/api/routesF/mod-notes-viewer?creator_id=creator_123&viewer_id=viewer_456&note_id=${noteId}`,
        { method: 'DELETE' }
      );

      response = await DELETE(request);
      data = await response.json();
      expect(response.status).toBe(200);

      // Verify deletion
      request = new Request(
        'http://localhost/api/routesF/mod-notes-viewer?creator_id=creator_123&viewer_id=viewer_456',
        { method: 'GET' }
      );

      response = await GET(request);
      data = await response.json();
      expect(data.total).toBe(0);
    });
  });
});
