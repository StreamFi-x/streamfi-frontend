/**
 * A job failure that retrying cannot fix (invalid payload, a record that no
 * longer exists, a bug that fails the same way every time). The job is
 * dead-lettered at once instead of being retried.
 */
export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentJobError";
  }
}
