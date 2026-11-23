import fs from "fs";
import path from "path";

describe("db/schema.sql completeness (#1867)", () => {
  const schemaPath = path.resolve(__dirname, "../../db/schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");

  it("contains all production-dependent columns on users table", () => {
    expect(schema).toMatch(/latency_mode\s+VARCHAR/i);
    expect(schema).toMatch(/stream_privacy\s+VARCHAR/i);
    expect(schema).toMatch(/share_token\s+VARCHAR/i);
    expect(schema).toMatch(/mux_signed_playback_id\s+VARCHAR/i);
  });

  it("contains needs_review column on stream_recordings table", () => {
    expect(schema).toMatch(/needs_review\s+BOOLEAN\s+DEFAULT\s+FALSE/i);
  });

  it("defines transcription_jobs table and indexes", () => {
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS transcription_jobs/i);
    expect(schema).toMatch(/idx_transcription_jobs_recording_id/i);
    expect(schema).toMatch(/idx_transcription_jobs_user_id/i);
    expect(schema).toMatch(/idx_transcription_jobs_status/i);
  });
});
