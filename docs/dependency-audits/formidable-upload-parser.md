# Dependency audit: formidable (multipart upload parser)

Tracks issue #1763: a targeted security audit of `formidable`, the multipart
form parser used across avatar uploads, thumbnail uploads, and bug report
attachments.

## Installed version range

`package.json` pins `formidable` to `^3.5.4`, meaning npm will install
`>=3.5.4 <4.0.0`.

## Known vulnerabilities checked

Queried the GitHub Advisory Database (`GET /advisories?affects=formidable`)
for every advisory filed against this package.

| Advisory | Severity | Affected range | Patched in | Excluded by `^3.5.4`? |
| --- | --- | --- | --- | --- |
| [GHSA-8cp3-66vr-3r4c](https://github.com/advisories/GHSA-8cp3-66vr-3r4c) | Critical | `< 3.2.4` | 3.2.4 | Yes |
| [GHSA-75v8-2h7p-7m2m](https://github.com/advisories/GHSA-75v8-2h7p-7m2m) / CVE-2025-46653 | Low | `>= 3.1.1-canary.20211030, < 3.5.3` (also affects 2.x before 2.1.3) | 3.5.3 | Yes |

Both known advisories against the 3.x line are patched at or before 3.5.3.
`^3.5.4` cannot resolve to any version below 3.5.4, so both are excluded by
the current pin. There is no unpatched advisory currently open against any
3.x release.

## Whether the security scanning workflow would catch a future vulnerability by name

`.github/workflows/security.yml` runs `actions/dependency-review-action@v4`
on every pull request, configured with `fail-on-severity: high`. This action
does check each changed dependency against the GitHub Advisory Database
individually and names the specific vulnerable package and advisory in its
output, it does not only report an aggregate severity count. So a future
`high` or `critical` severity advisory against `formidable` (like
GHSA-8cp3-66vr-3r4c above) would be caught and named, failing the PR that
introduced it.

The gap is the severity floor: a future `low` or `moderate` advisory against
`formidable`, similar in severity to GHSA-75v8-2h7p-7m2m, would not fail the
`dependency-review` job, since it is below the configured `fail-on-severity:
high` threshold. The weekly `npm audit` surface from this repo's new
Dependabot configuration (#1760) is the backstop for that gap: Dependabot
opens a dedicated PR for any dependency with a known advisory regardless of
severity, independent of this workflow's threshold.

## Additional upload-path defenses

Beyond the parser version itself, `formidable` is invoked directly in the
avatar, thumbnail, and bug report upload routes. This audit did not find a
request body size limit or per-IP upload rate limit configured ahead of
those routes at the application level (Next.js's own default body size
limit for Route Handlers applies, but no additional explicit limit was
found). Given the number of separate upload entry points, adding an explicit
`maxFileSize` per route (formidable already supports this option) and a
basic rate limit on upload routes specifically is recommended as a
follow-up, tracked separately rather than folded into this audit, since it
is a defense-in-depth addition rather than confirmation of an existing gap
in the currently pinned version.

## Conclusion

The installed `formidable` version range (`^3.5.4`) excludes both known
advisories filed against the package. The existing `dependency-review`
workflow would catch and name a future `high` or `critical` advisory against
this package; a future `low` or `moderate` advisory would not fail that
specific job, but would be independently surfaced by the Dependabot
configuration added in #1760.
