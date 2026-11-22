/**
 * @jest-environment node
 *
 * Integration test verifying Issue #1868: Foreign key cascade and nullify actions
 * on user deletion in real PostgreSQL.
 */
import { applyAppSchema } from "@/test-utils/app-schema-fixture";
import {
  createTestSchema,
  describeWithDb,
  TestSchema,
} from "@/test-utils/pg-test-db";

jest.setTimeout(30_000);

describeWithDb("User Deletion Foreign Key Cascades (#1868)", () => {
  let schema: TestSchema;
  let creatorId: string;
  let subscriberId: string;
  let moderatorId: string;

  beforeEach(async () => {
    schema = await createTestSchema("cascade_test");
    await applyAppSchema(schema.pool);

    const client = await schema.connect();
    try {
      const c = await client.query(
        `INSERT INTO users (username, wallet) VALUES ('creator_user', 'GCREATOR_WALLET') RETURNING id`
      );
      creatorId = c.rows[0].id;

      const s = await client.query(
        `INSERT INTO users (username, wallet) VALUES ('subscriber_user', 'GSUBSCRIBER_WALLET') RETURNING id`
      );
      subscriberId = s.rows[0].id;

      const m = await client.query(
        `INSERT INTO users (username, wallet) VALUES ('moderator_user', 'GMODERATOR_WALLET') RETURNING id`
      );
      moderatorId = m.rows[0].id;

      // Seed subscriptions
      await client.query(
        `INSERT INTO subscriptions (subscriber_id, creator_id, expires_at, status)
         VALUES ($1, $2, now() + interval '30 days', 'active')`,
        [subscriberId, creatorId]
      );

      // Seed chat message moderated by moderatorId
      await client.query(
        `INSERT INTO chat_messages (user_id, content, is_moderated, moderated_by)
         VALUES ($1, 'Hello StreamFi chat', true, $2)`,
        [subscriberId, moderatorId]
      );

      // Seed watch history
      await client.query(
        `INSERT INTO watch_history (viewer_id, streamer_id, stream_type, stream_title, watch_seconds)
         VALUES ($1, $2, 'live', 'Live Coding Stream', 300)`,
        [subscriberId, creatorId]
      );
    } finally {
      await client.end();
    }
  });

  afterEach(async () => {
    await schema.drop();
  });

  it("deleting a moderator nullifies moderated_by while preserving chat messages", async () => {
    const client = await schema.connect();
    try {
      await client.query(`DELETE FROM users WHERE id = $1`, [moderatorId]);

      const res = await client.query(
        `SELECT id, content, is_moderated, moderated_by FROM chat_messages WHERE content = 'Hello StreamFi chat'`
      );
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].moderated_by).toBeNull();
      expect(res.rows[0].is_moderated).toBe(true);
    } finally {
      await client.end();
    }
  });

  it("deleting a creator cascades subscriptions and watch_history where streamer_id = creator", async () => {
    const client = await schema.connect();
    try {
      await client.query(`DELETE FROM users WHERE id = $1`, [creatorId]);

      const subs = await client.query(
        `SELECT * FROM subscriptions WHERE creator_id = $1`,
        [creatorId]
      );
      expect(subs.rows).toHaveLength(0);

      const wh = await client.query(
        `SELECT * FROM watch_history WHERE streamer_id = $1`,
        [creatorId]
      );
      expect(wh.rows).toHaveLength(0);
    } finally {
      await client.end();
    }
  });

  it("deleting a subscriber cascades subscriptions and watch_history where subscriber/viewer = user", async () => {
    const client = await schema.connect();
    try {
      await client.query(`DELETE FROM users WHERE id = $1`, [subscriberId]);

      const subs = await client.query(
        `SELECT * FROM subscriptions WHERE subscriber_id = $1`,
        [subscriberId]
      );
      expect(subs.rows).toHaveLength(0);

      const wh = await client.query(
        `SELECT * FROM watch_history WHERE viewer_id = $1`,
        [subscriberId]
      );
      expect(wh.rows).toHaveLength(0);
    } finally {
      await client.end();
    }
  });
});
