# Error monitoring

Set `NEXT_PUBLIC_SENTRY_DSN` for browser monitoring. Set `SENTRY_DSN` to
override the server destination. Configure `SENTRY_ORG`, `SENTRY_PROJECT`
and `SENTRY_AUTH_TOKEN` in the Vercel build environment to upload source
maps. Keep the auth token server-side.

On an isolated staging deployment, throw a synthetic error from a client
component and a server route. Check that both arrive with resolved frames.
Use fake identities in fixtures and verify the event contains no user,
request, raw error message, breadcrumbs, or arbitrary metadata. Remove the
temporary throws before sharing the deployment. Clear the DSNs to disable
delivery and remove the build token to disable map upload.
