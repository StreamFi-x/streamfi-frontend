# Hash Generator Endpoint

## Summary
Adds a new hashing endpoint at `POST /api/routes-f/hash` supporting MD5, SHA-1, SHA-256, and SHA-512 algorithms. Useful for checksum generation and debugging.

## Implementation

### Files Added
- `app/api/routes-f/hash/route.ts` - Main route handler with POST and OPTIONS methods
- `app/api/routes-f/hash/_lib/types.ts` - TypeScript type definitions
- `app/api/routes-f/hash/_lib/helpers.ts` - Core hashing logic using Node's crypto module
- `app/api/routes-f/hash/__tests__/route.test.ts` - Route handler tests (55 tests)
- `app/api/routes-f/hash/__tests__/helpers.test.ts` - Helper function tests (16 tests)

### API Specification

**Endpoint:** `POST /api/routes-f/hash`

**Request Body:**
```json
{
  "input": "string to hash",
  "algorithm": "md5" | "sha1" | "sha256" | "sha512",
  "encoding": "hex" | "base64"  // optional, defaults to "hex"
}
```

**Success Response (200):**
```json
{
  "hash": "computed hash string",
  "algorithm": "sha256",
  "encoding": "hex",
  "warning": "optional warning for insecure algorithms"
}
```

**Error Response (400):**
```json
{
  "error": "error message"
}
```

### Features
- ✅ Supports 4 algorithms: MD5, SHA-1, SHA-256, SHA-512
- ✅ Supports 2 encodings: hex (default), base64
- ✅ Security warnings for MD5 and SHA-1 (not cryptographically secure)
- ✅ Comprehensive input validation
- ✅ CORS support via OPTIONS handler
- ✅ 71 unit tests with RFC test vectors
- ✅ All tests passing
- ✅ TypeScript strict mode compliant
- ✅ Build successful

### Test Coverage
- **Known-vector tests:** Validates against RFC 1321 (MD5), RFC 3174 (SHA-1), and NIST FIPS 180-4 (SHA-256/512)
- **Encoding tests:** Verifies both hex and base64 output
- **Validation tests:** Ensures proper error handling for invalid inputs
- **Security tests:** Confirms warnings for insecure algorithms

### Example Usage

```bash
# SHA-256 hash (hex)
curl -X POST http://localhost:3000/api/routes-f/hash \
  -H "Content-Type: application/json" \
  -d '{"input":"hello world","algorithm":"sha256"}'

# MD5 hash (base64) - includes security warning
curl -X POST http://localhost:3000/api/routes-f/hash \
  -H "Content-Type: application/json" \
  -d '{"input":"test","algorithm":"md5","encoding":"base64"}'
```

### Scope Compliance
✅ All files contained within `app/api/routes-f/hash/`  
✅ No dependencies on external lib/, utils/, or components/  
✅ Self-contained and independently mergeable

## Testing
```bash
npm test -- app/api/routes-f/hash  # Run all tests (71 passing)
npm run build                       # Verify build succeeds
npm run type-check                  # Verify TypeScript compliance
```
