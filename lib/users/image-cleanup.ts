import { deleteImage, extractPublicIdFromUrl } from "@/utils/upload/cloudinary";
import { logger } from "@/lib/tracing/logger";

/**
 * Tracks Cloudinary images touched by a profile update so they are only
 * deleted once the database agrees with the outcome:
 *  - commit(): the row was updated, so the replaced images are now unreferenced.
 *  - rollback(): the update failed, so the freshly uploaded images are orphans
 *    and the old ones must stay intact.
 * Cloudinary failures here are logged and never fail the request.
 */
export function createImageCleanup() {
  const uploaded: string[] = [];
  const replaced: string[] = [];

  async function destroy(publicId: string, reason: string) {
    try {
      await deleteImage(publicId);
    } catch (error) {
      logger.error(
        `Failed to delete ${reason} Cloudinary image`,
        error,
        {
          module: "users/image-cleanup",
          operation: "destroy",
          publicId,
          reason,
        }
      );
    }
  }

  return {
    /** A new image was uploaded; delete it if the DB update fails. */
    trackUpload(publicId: string) {
      uploaded.push(publicId);
    },
    /** The old image is being replaced; delete it once the DB update succeeds. */
    trackReplaced(oldUrl: string | null | undefined) {
      if (!oldUrl) {
        return;
      }
      const publicId = extractPublicIdFromUrl(oldUrl);
      if (publicId) {
        replaced.push(publicId);
      }
    },
    async commit() {
      for (const publicId of replaced) {
        await destroy(publicId, "replaced");
      }
    },
    async rollback() {
      for (const publicId of uploaded) {
        await destroy(publicId, "orphaned upload");
      }
    },
  };
}
