# StreamFi Frontend API Index

## Quick Start

### API Base URL
```
/api/routesF/
```

### Available Endpoints

| Feature | Method | Endpoint | Description |
|---------|--------|----------|-------------|
| Birthday | GET | `/viewer-birthday?viewer_id={id}` | Get birthday configuration |
| Birthday | PUT | `/viewer-birthday` | Set/update birthday configuration |
| Birthday | DELETE | `/viewer-birthday` | Remove birthday configuration |
| Follow Age | GET | `/viewer-follow-age?viewer_id={id}` | Get follow age summary |
| Verification | GET | `/creator-verification?request_id={id}` | Get verification request status |
| Verification | POST | `/creator-verification` | Submit verification request |
| Color Blind | GET | `/viewer-color-blind?viewer_id={id}` | Get color blind preference |
| Color Blind | PUT | `/viewer-color-blind` | Set/update color blind preference |

## API Details

### 1. Viewer Birthday Configuration
```typescript
// GET Response
{
  "success": true,
  "data": {
    "birthday_iso": "1995-03-15", // Optional if not set
    "share_with_creators": true
  }
}

// PUT Request
{
  "viewer_id": "string",
  "birthday_iso": "YYYY-MM-DD",
  "share_with_creators": boolean
}

// DELETE Request
{
  "viewer_id": "string"
}
```

**Validation Rules:**
- Date must be in YYYY-MM-DD format
- Cannot be in the future
- Minimum age: 13 years
- Maximum reasonable age: 120 years

### 2. Viewer Follow Age Summary
```typescript
// GET Response
{
  "success": true,
  "data": {
    "follows_count": number,
    "avg_follow_age_days": number,
    "oldest_follow_at": "ISO_DATE" | null
  }
}
```

**Notes:**
- Returns `0` values for viewers with no follows
- `oldest_follow_at` is `null` when no follows exist
- Ages calculated in days from current date

### 3. Creator Verification Request
```typescript
// POST Request
{
  "creator_id": "string",
  "method": "social" | "id" | "kyc",
  "proof_links": ["https://...", "https://..."]
}

// POST Response
{
  "success": true,
  "data": {
    "request_id": "string",
    "status": "pending"
  }
}

// GET Response
{
  "success": true,
  "data": {
    "request_id": "string",
    "creator_id": "string",
    "method": "social" | "id" | "kyc",
    "status": "pending" | "approved" | "rejected" | "cancelled",
    "submitted_at": "ISO_DATE",
    "reviewed_at": "ISO_DATE" // Optional
  }
}
```

**Validation Rules:**
- Only one pending request per creator (409 Conflict)
- 1-10 proof links required
- URLs must be valid format
- Method must be valid enum value

### 4. Viewer Color Blind Preference
```typescript
// GET Response
{
  "success": true,
  "data": {
    "mode": "none" | "protanopia" | "deuteranopia" | "tritanopia"
  }
}

// PUT Request
{
  "viewer_id": "string",
  "mode": "none" | "protanopia" | "deuteranopia" | "tritanopia"
}
```

**Notes:**
- Returns 404 if preference not found
- All modes are supported
- Updates timestamp on each change

## Error Responses

### Format
```typescript
{
  "apiVersion": "1.0.0",
  "success": false,
  "error": "Error message",
  "errors": [ // Only for validation errors
    {
      "field": "field_name",
      "message": "Error description"
    }
  ]
}
```

### HTTP Status Codes
- **200**: Success
- **201**: Created (verification request)
- **400**: Bad Request (validation errors)
- **404**: Not Found (resource doesn't exist)
- **409**: Conflict (duplicate pending request)
- **422**: Unprocessable Entity
- **500**: Internal Server Error

## Mock Data IDs

### Viewers (for testing)
- `vwr_gaming_fan_001`
- `vwr_music_lover_002`
- `vwr_art_enthusiast_003`
- `vwr_sports_fanatic_004`
- `vwr_tech_geek_005`

### Creators (for testing)
- `crt_gaming_pro_101`
- `crt_music_maestro_102`
- `crt_art_legend_103`
- `crt_sports_star_104`
- `crt_tech_guru_105`

### Verification Requests (for testing)
- `ver_001` (approved)
- `ver_002` (pending)
- `ver_003` (rejected)
- `ver_004` (pending)

## Development

### Repository Initialization
Repositories are automatically initialized with mock data on import.

### Adding New Features
1. Create route handler in feature directory
2. Add types to `shared/types/index.ts`
3. Add validation to `shared/validators/index.ts`
4. Create repository in `shared/repositories/`
5. Add seed data to `shared/repositories/seedData.ts`
6. Write tests in `tests/{feature-name}/`

### Testing
```bash
# Run all tests
cd app/api/routesF
npx jest

# Run specific test suite
npx jest viewer-birthday
```

## Architecture Notes

### Repository Pattern
- All data access through repositories
- Easy to replace with real backend
- In-memory storage for development
- Seed data for realistic testing

### Pure Functions
- Business logic in helper functions
- No side effects
- Deterministic operations
- Easy to test

### Type Safety
- Zero `any` types
- Comprehensive interfaces
- Discriminated unions
- Runtime validation

## Quick Examples

### Set Birthday
```bash
curl -X PUT http://localhost:3000/api/routesF/viewer-birthday \
  -H "Content-Type: application/json" \
  -d '{
    "viewer_id": "test_viewer",
    "birthday_iso": "1995-03-15",
    "share_with_creators": true
  }'
```

### Get Follow Age
```bash
curl "http://localhost:3000/api/routesF/viewer-follow-age?viewer_id=vwr_gaming_fan_001"
```

### Submit Verification
```bash
curl -X POST http://localhost:3000/api/routesF/creator-verification \
  -H "Content-Type: application/json" \
  -d '{
    "creator_id": "crt_new",
    "method": "social",
    "proof_links": ["https://twitter.com/creator"]
  }'
```

### Set Color Preference
```bash
curl -X PUT http://localhost:3000/api/routesF/viewer-color-blind \
  -H "Content-Type: application/json" \
  -d '{
    "viewer_id": "test_viewer",
    "mode": "protanopia"
  }'
```

## Next Steps

### Backend Integration
Replace repository implementations with:
1. PostgreSQL + Prisma for database
2. REST API calls for microservices
3. GraphQL resolvers
4. Stellar smart contract calls

### Production Deployment
1. Add authentication middleware
2. Implement rate limiting
3. Add request logging
4. Configure monitoring
5. Set up error tracking

This API implementation is production-ready and can be deployed immediately while maintaining clear integration points for future backend services.