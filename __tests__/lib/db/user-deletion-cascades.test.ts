/**
 * @jest-environment node
 *
 * Unit tests verifying foreign key cascades on user deletion (Issue #1868).
 * Covers relational integrity expectations and migration structure:
 *  - subscriptions.subscriber_id and streamer_id/creator_id -> ON DELETE CASCADE
 *  - chat_messages.moderated_by -> ON DELETE SET NULL
 *  - watch_history.streamer_id and viewer_id/user_id -> ON DELETE CASCADE
 */
import * as fs from "fs";
import * as path from "path";

describe("User Deletion Foreign Key Cascades & Migration (#1868)", () => {
  const migrationPath = path.resolve(
    process.cwd(),
    "db/migrations/20261122140000_fix_user_foreign_keys_on_delete.sql"
  );
  const schemaPath = path.resolve(process.cwd(), "db/schema.sql");

  it("migration file exists and adheres to versioned naming convention", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const filename = path.basename(migrationPath);
    expect(filename).toMatch(/^\d{14}_fix_user_foreign_keys_on_delete\.sql$/);
  });

  it("migration contains idempotent constraint drop and cascade actions for subscriptions", () => {
    const migrationSql = fs.readFileSync(migrationPath, "utf8");

    // Drop constraints idempotently
    expect(migrationSql).toContain("subscriptions_subscriber_id_fkey");
    expect(migrationSql).toContain("subscriptions_streamer_id_fkey");
    expect(migrationSql).toContain("subscriptions_creator_id_fkey");

    // Foreign key with ON DELETE CASCADE
    expect(migrationSql).toMatch(
      /FOREIGN KEY\s*\(\s*subscriber_id\s*\)\s*REFERENCES\s*users\s*\(\s*id\s*\)\s*ON\s+DELETE\s+CASCADE/i
    );
    expect(migrationSql).toMatch(
      /FOREIGN KEY\s*\(\s*streamer_id\s*\)\s*REFERENCES\s*users\s*\(\s*id\s*\)\s*ON\s+DELETE\s+CASCADE/i
    );
    expect(migrationSql).toMatch(
      /FOREIGN KEY\s*\(\s*creator_id\s*\)\s*REFERENCES\s*users\s*\(\s*id\s*\)\s*ON\s+DELETE\s+CASCADE/i
    );
  });

  it("migration contains idempotent constraint drop and SET NULL action for chat_messages.moderated_by", () => {
    const migrationSql = fs.readFileSync(migrationPath, "utf8");

    expect(migrationSql).toContain("chat_messages_moderated_by_fkey");
    expect(migrationSql).toMatch(
      /FOREIGN KEY\s*\(\s*moderated_by\s*\)\s*REFERENCES\s*users\s*\(\s*id\s*\)\s*ON\s+DELETE\s+SET\s+NULL/i
    );
  });

  it("migration contains idempotent constraint drop and cascade actions for watch_history", () => {
    const migrationSql = fs.readFileSync(migrationPath, "utf8");

    expect(migrationSql).toContain("watch_history_streamer_id_fkey");
    expect(migrationSql).toMatch(
      /FOREIGN KEY\s*\(\s*streamer_id\s*\)\s*REFERENCES\s*users\s*\(\s*id\s*\)\s*ON\s+DELETE\s+CASCADE/i
    );
    expect(migrationSql).toMatch(
      /FOREIGN KEY\s*\(\s*viewer_id\s*\)\s*REFERENCES\s*users\s*\(\s*id\s*\)\s*ON\s+DELETE\s+CASCADE/i
    );
  });

  it("db/schema.sql defines ON DELETE SET NULL for chat_messages.moderated_by", () => {
    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    expect(schemaSql).toMatch(
      /moderated_by\s+UUID\s+REFERENCES\s+users\s*\(\s*id\s*\)\s+ON\s+DELETE\s+SET\s+NULL/i
    );
  });

  it("db/schema.sql defines ON DELETE CASCADE for watch_history.streamer_id", () => {
    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    expect(schemaSql).toMatch(
      /streamer_id\s+UUID\s+REFERENCES\s+users\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i
    );
  });

  describe("Simulated Relational Integrity Engine", () => {
    interface User {
      id: string;
      username: string;
    }
    interface Subscription {
      id: string;
      subscriber_id: string;
      creator_id: string;
    }
    interface ChatMessage {
      id: string;
      user_id: string;
      content: string;
      is_moderated: boolean;
      moderated_by: string | null;
    }
    interface WatchHistory {
      id: string;
      viewer_id: string;
      streamer_id: string;
    }

    let users: User[];
    let subscriptions: Subscription[];
    let chatMessages: ChatMessage[];
    let watchHistory: WatchHistory[];

    beforeEach(() => {
      users = [
        { id: "u-creator", username: "creator" },
        { id: "u-sub", username: "subscriber" },
        { id: "u-mod", username: "moderator" },
      ];
      subscriptions = [
        { id: "sub-1", subscriber_id: "u-sub", creator_id: "u-creator" },
      ];
      chatMessages = [
        {
          id: "msg-1",
          user_id: "u-sub",
          content: "Great stream!",
          is_moderated: true,
          moderated_by: "u-mod",
        },
      ];
      watchHistory = [
        { id: "wh-1", viewer_id: "u-sub", streamer_id: "u-creator" },
      ];
    });

    function deleteUserRelational(userId: string) {
      // 1. users row deleted
      users = users.filter(u => u.id !== userId);

      // 2. subscriptions: ON DELETE CASCADE on subscriber_id and creator_id
      subscriptions = subscriptions.filter(
        s => s.subscriber_id !== userId && s.creator_id !== userId
      );

      // 3. chat_messages: ON DELETE SET NULL on moderated_by, ON DELETE CASCADE/SET NULL on user_id
      chatMessages = chatMessages.map(m => {
        if (m.moderated_by === userId) {
          return { ...m, moderated_by: null };
        }
        return m;
      });

      // 4. watch_history: ON DELETE CASCADE on streamer_id and viewer_id
      watchHistory = watchHistory.filter(
        w => w.streamer_id !== userId && w.viewer_id !== userId
      );
    }

    it("deleting user with subscriptions cascades properly without foreign key violation", () => {
      expect(subscriptions).toHaveLength(1);
      deleteUserRelational("u-creator");

      expect(users.find(u => u.id === "u-creator")).toBeUndefined();
      expect(
        subscriptions.filter(s => s.creator_id === "u-creator")
      ).toHaveLength(0);
      expect(subscriptions).toHaveLength(0);
    });

    it("deleting user with moderated messages sets moderated_by to null while preserving message", () => {
      expect(chatMessages[0].moderated_by).toBe("u-mod");
      deleteUserRelational("u-mod");

      expect(users.find(u => u.id === "u-mod")).toBeUndefined();
      expect(chatMessages).toHaveLength(1);
      expect(chatMessages[0].content).toBe("Great stream!");
      expect(chatMessages[0].is_moderated).toBe(true);
      expect(chatMessages[0].moderated_by).toBeNull();
    });

    it("deleting user with watch history removes associated rows", () => {
      expect(watchHistory).toHaveLength(1);
      deleteUserRelational("u-sub");

      expect(users.find(u => u.id === "u-sub")).toBeUndefined();
      expect(watchHistory.filter(w => w.viewer_id === "u-sub")).toHaveLength(0);
      expect(watchHistory).toHaveLength(0);
    });
  });
});
