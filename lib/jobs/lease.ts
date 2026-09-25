import { randomUUID } from "crypto";
import { sql } from "@vercel/postgres";

export interface JobLease {
  jobName: string;
  holder: string;
}

/**
 * Take the named job's lease if nobody holds an unexpired one.
 *
 * A single INSERT ... ON CONFLICT statement is atomic, so two workers racing
 * for the same job can never both acquire it. Session-level advisory locks are
 * not used because @vercel/postgres may run consecutive queries on different
 * connections.
 */
export async function acquireLease(
  jobName: string,
  ttlSeconds: number
): Promise<JobLease | null> {
  const holder = randomUUID();
  const { rows } = await sql`
    INSERT INTO job_leases (job_name, holder, lease_until, acquired_at)
    VALUES (${jobName}, ${holder}, now() + make_interval(secs => ${ttlSeconds}), now())
    ON CONFLICT (job_name) DO UPDATE
      SET holder = EXCLUDED.holder,
          lease_until = EXCLUDED.lease_until,
          acquired_at = EXCLUDED.acquired_at
      WHERE job_leases.lease_until < now()
    RETURNING holder
  `;
  return rows[0]?.holder === holder ? { jobName, holder } : null;
}

/** Extend the lease. Returns false if it expired and another worker took it. */
export async function renewLease(
  lease: JobLease,
  ttlSeconds: number
): Promise<boolean> {
  const { rows } = await sql`
    UPDATE job_leases
    SET lease_until = now() + make_interval(secs => ${ttlSeconds})
    WHERE job_name = ${lease.jobName} AND holder = ${lease.holder}
    RETURNING holder
  `;
  return rows.length === 1;
}

export async function releaseLease(lease: JobLease): Promise<void> {
  await sql`
    UPDATE job_leases
    SET lease_until = now()
    WHERE job_name = ${lease.jobName} AND holder = ${lease.holder}
  `;
}
