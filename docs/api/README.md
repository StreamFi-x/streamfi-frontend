# API specification

`docs/api/openapi.json` is the OpenAPI 3.1 description of the tips, streams and
users route groups under `app/api`. Open it in any OpenAPI viewer (Swagger UI,
Redoc, Postman import) to browse the API without reading route source.

Related contracts:

- [pagination.md](./pagination.md): `limit` / `cursor` and the
  `{ items, nextCursor, hasMore }` envelope.
- Correlation IDs: send `x-correlation-id` on every call of one user action.
  See "Correlation IDs" in `TRACING_ARCHITECTURE.md`.

## Keeping it current

The spec is maintained by hand and guarded by
`__tests__/docs/openapi-staleness.test.ts`, which runs in `npm test` and CI. It
scans `app/api/{tips,streams,users}/**/route.ts` and fails when:

- a route or exported HTTP method has no entry in the spec (add it), or
- the spec describes a route or method that no longer exists (remove it).

It also checks that every operation has a unique `operationId` and a response,
and that every `$ref` resolves.

When you add or change a route in these groups:

1. Add or update its entry under `paths` in `openapi.json`.
2. Reuse `components` (`Error`, `Limit`, `Cursor`, `CorrelationId`) where they
   apply. List endpoints use the shared pagination parameters and envelope.
3. Run `npx jest __tests__/docs`.

Entries without a hand-written summary carry a placeholder summary and generic
responses; improving them, and extending the spec to the remaining route groups
(admin, wallet, and others), is welcome. Add a group by listing it in `GROUPS`
in the test.

`app/api/streamfi-api.yaml` is an older, partial description of a few user and
waitlist routes and is superseded by this file for the groups above.
