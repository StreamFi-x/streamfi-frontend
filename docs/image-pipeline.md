# Image pipeline: sharp and Cloudinary (#1419)

**Decision:** Cloudinary is the single place user images are stored,
processed and delivered. The `sharp` dependency is removed. Next.js keeps its
own copy of sharp (an optional dependency of `next`) for `next/image`
optimisation of static assets. That copy is part of Next.js, not an image
pipeline of ours.

## Inventory (as found)

| Call site                                                                                       | Feature                             | Processing                                                  | Storage                           | Delivery             | Tool                                   | Persisted in                         |
| ----------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------- | --------------------------------- | -------------------- | -------------------------------------- | ------------------------------------ |
| `app/api/users/updates/[wallet]/route.ts`, `.../privy/[privyId]/route.ts`                       | Avatar and banner upload            | none                                                        | Cloudinary `avatars/`             | `secure_url`         | Cloudinary `upload_stream` / `destroy` | `users.avatar`, `users.banner`       |
| `app/api/admin/categories/image/route.ts`                                                       | Category image                      | type/size check                                             | Cloudinary `categories/`          | `secure_url`         | Cloudinary `upload_stream`             | `stream_categories.imageurl`         |
| `app/api/streams/update/route.ts`                                                               | Stream thumbnail (base64)           | none                                                        | Cloudinary `stream-thumbnails/`   | `secure_url`         | Cloudinary `upload`                    | `users.creator->thumbnail`           |
| `app/api/routes-f/preview/custom/route.ts`                                                      | Custom preview thumbnail from a URL | server downloaded the URL; **sharp read width/height only** | none (external URL stored)        | original URL         | **sharp** (the only import)            | `users.creator->customThumbnailUrl`  |
| `routes-f/profile-update-avatar`, `profile-update-banner`, `channel/banner`, `clip-cover-image` | URL registration                    | client-supplied metadata only                               | external / in-memory              | original URL         | none                                   | `users.avatar`, `users.banner`       |
| Live/VOD thumbnails, snapshots, OG metadata (`image.mux.com`)                                   | Stream imagery                      | Mux URL transforms                                          | Mux                               | `image.mux.com`      | Mux                                    | derived from playback ids            |
| `opengraph-image` routes                                                                        | OG images                           | Satori/resvg                                                | none                              | generated            | `next/og`                              | reads `users.avatar`                 |
| `components/settings/profile/profile-header.tsx`                                                | Banner before upload                | canvas resize/JPEG in the browser                           | n/a                               | n/a                  | browser                                | n/a                                  |
| `lib/profile-icons.ts`, `public/Images/**`                                                      | Preset avatars, static art          | `next/image` optimiser                                      | repo                              | `/_next/image`       | Next's own sharp                       | `users.avatar` (`/Images/...` paths) |
| Email templates                                                                                 | Static email images                 | `f_auto,q_auto` in one template                             | Cloudinary (two hardcoded clouds) | `res.cloudinary.com` | Cloudinary                             | none                                 |

Findings:

- **No overlap and no half-finished migration.** sharp never processed or
  stored an image: it only measured the one the custom-thumbnail route
  downloaded. Every stored user image was already on Cloudinary. sharp was
  added in 2025-03 (`27bc4b2`) and first imported a year later, for that
  single check. It was a leftover dependency, not a second pipeline.
- Components render Cloudinary URLs with a plain `<img>` (bypassing
  `next/image`), so Cloudinary images are neither re-processed by Next nor
  transformed by Cloudinary today.
- Existing data: Cloudinary URLs in `users.avatar`, `users.banner`,
  `stream_categories.imageurl` and `users.creator` thumbnails; preset icon
  paths; external URLs from the URL-registration routes.

## Why Cloudinary, not sharp

|                   | Cloudinary                                                    | sharp in-app                                                           |
| ----------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Storage and CDN   | Included                                                      | Would need new object storage and a CDN (none exist here)              |
| Existing data     | All stored user images already there                          | Every URL would need migrating                                         |
| Transformations   | On request by URL (size, format, quality), cached at the edge | Precompute each size at upload, inside function time and memory limits |
| Runtime           | No native code in our functions                               | ~30MB native libvips binary per function                               |
| Cost              | Usage-based (storage, transformations, bandwidth)             | Compute plus storage plus CDN we would have to build                   |
| Vendor dependency | Yes, already accepted for all uploads                         | None                                                                   |

Moving to sharp would mean building storage and delivery that do not exist
and migrating every stored URL, to replace a service that already works.
Keeping sharp only for the dimension check meant shipping a native image
library to measure one image. Cloudinary does that as part of the upload.

## Migration

- `preview/custom` no longer downloads the user-supplied URL. It calls
  `importRemoteImage` (`utils/upload/cloudinary.ts`): Cloudinary fetches the
  URL into `stream-thumbnails/` with `allowed_formats` jpg/png/webp and returns
  width, height and bytes. An image under 1280×720 or over 10MB is deleted
  again and rejected (400); a Cloudinary outage is a 502. The stored value is
  now the Cloudinary copy, so the thumbnail no longer depends on the original
  host staying up. The previous custom thumbnail is deleted when it is
  replaced or removed, if it is one of ours.
  - Side effect: the server no longer fetches arbitrary URLs on a user's
    behalf, closing a server-side request forgery risk (the old code
    downloaded any http(s) URL, including internal addresses, in full).
- Public-id extraction (duplicated in both avatar routes) is now one function,
  `extractPublicIdFromUrl`, which only accepts
  `https://res.cloudinary.com/<CLOUDINARY_CLOUD_NAME>/image/upload/...`.
  Previously any URL with an `/upload/` segment was accepted, so a crafted
  avatar URL (`https://x/a/upload/v1/<someone's public id>.jpg`) would have
  deleted another user's image on the next avatar change.
- **Existing data needs no migration.** Stored Cloudinary URLs are unchanged.
  Existing external `customThumbnailUrl` values keep rendering as before; they
  are replaced with a Cloudinary copy the next time the creator sets a
  thumbnail, and are never passed to `deleteImage`.
- `sharp` was removed from `package.json` after `git grep` showed no import
  left. `next/node_modules/sharp` (0.34, with its linux-x64 binaries) remains
  in the lockfile for Next.js.

## Guidance for new code

- User-uploaded or user-linked images: upload through
  `utils/upload/cloudinary.ts` (`uploadImageFromBuffer`, or
  `importRemoteImage` for URLs), store `secure_url`, and delete only ids
  from `extractPublicIdFromUrl`.
- Resizing and format: use Cloudinary delivery transformations in the URL
  (e.g. `/image/upload/f_auto,q_auto,w_320/...`) rather than processing in the
  function. Nothing uses them yet; adopting them in the avatar and card
  components is a possible follow-up.
- Static assets in `public/`: `next/image` as today.

## Not changed here (found during the audit)

- The avatar, banner and stream-thumbnail upload routes do not check a
  session or validate type/size on the server. That needs its own fix.
- `next.config.cjs` is never loaded (Next 16 reads `next.config.js`).
- `formidable` and `@types/formidable` are only referenced by a commented-out
  file.
- `users.banner` is written by the code but not defined in `db/schema.sql` or
  any migration.
