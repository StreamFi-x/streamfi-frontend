# Channel Points API Summary

## Quick Reference

### Base URL
```
/api/routes-f/channel-points
```

### Catalog Management
| Method | Endpoint | Description | Parameters |
|--------|----------|-------------|------------|
| GET | `/catalog` | Get creator's catalog | `creator_id` (query) |
| POST | `/catalog` | Create catalog item | `creator_id`, `name`, `cost`, `cooldown_seconds`, `enabled?` |
| PATCH | `/catalog/{id}` | Update catalog item | `id` (path), `name?`, `cost?`, `cooldown_seconds?`, `enabled?` |
| DELETE | `/catalog/{id}` | Delete catalog item | `id` (path) |

### Balance Management
| Method | Endpoint | Description | Parameters |
|--------|----------|-------------|------------|
| GET | `/balance` | Get viewer balance | `viewer_id`, `creator_id` (query) |
| POST | `/balance/grant` | Grant points | `viewer_id`, `creator_id`, `amount`, `reason` |
| POST | `/balance/spend` | Spend points | `viewer_id`, `creator_id`, `amount`, `item` |

## Data Models

### CatalogItem
```typescript
{
  id: string;                    // Auto-generated unique ID
  creator_id: string;           // Creator who owns this catalog
  name: string;                 // Redemption name (e.g., "Custom Emote")
  cost: number;                 // Points required (positive integer)
  cooldown_seconds: number;     // Cooldown between redemptions (non-negative)
  enabled: boolean;             // Whether redemption is available
  created_at: string;           // ISO timestamp
  updated_at: string;           // ISO timestamp
}
```

### Balance
```typescript
{
  viewer_id: string;           // Viewer who owns the balance
  creator_id: string;          // Creator whose channel the balance is for
  balance: number;             // Current available points
  lifetime_earned: number;     // Total points ever earned (grants only)
  created_at: string;          // ISO timestamp
  updated_at: string;          // ISO timestamp
}
```

## Business Rules

### Catalog Rules
- **Maximum 30 items per creator** - Creation rejected if limit reached
- **Cost must be positive** - `cost > 0`
- **Cooldown must be non-negative** - `cooldown_seconds >= 0`
- **Name must be non-empty** - `name.trim().length > 0`

### Balance Rules
- **No negative balances** - Spend rejected if `balance < amount`
- **Lifetime earned only increases** - Only grants increase `lifetime_earned`
- **Auto-creation** - Balance created on first grant if doesn't exist
- **Amount must be positive** - Both grants and spends require `amount > 0`

## Error Responses

All error responses follow this format:
```typescript
{
  error: string;               // Human-readable error message
  details?: Record<string, unknown>;  // Additional error context
}
```

### Common HTTP Status Codes
- **200 OK** - Success
- **201 Created** - Resource created successfully
- **400 Bad Request** - Validation error, insufficient balance, limit reached
- **404 Not Found** - Resource not found
- **500 Internal Server Error** - Unexpected server error

## Success Responses

All success responses follow this format:
```typescript
{
  data: T;                    // Response data (varies by endpoint)
  message?: string;           // Optional success message
  details?: Record<string, unknown>;  // Optional additional data
}
```

## Mock Storage Behavior

### In-Memory Storage
- Data persists only during server runtime
- Sample data initialized on server start
- Simple Map-based storage for easy replacement
- Thread-safe for single server instance

### Sample Data Includes
- 3 sample catalog items across 2 creators
- 3 sample balances across 2 viewers and 2 creators
- Realistic timestamps (1 day to 1 month ago)
- Variety of point amounts and redemption types

## Testing Coverage

### Catalog Tests Verify:
- ✓ Basic CRUD operations
- ✓ 30-item limit enforcement
- ✓ Field validation (cost, cooldown, name)
- ✓ Error handling (404, 400)
- ✓ Timestamp updates on modifications

### Balance Tests Verify:
- ✓ Balance retrieval
- ✓ Point grants (creates balance if needed)
- ✓ Point spends (rejects insufficient balance)
- ✓ Lifetime earned tracking (grants only)
- ✓ Field validation (amount, reason, item)
- ✓ Error handling (404, 400)

## Integration Points

### Easy to Replace
1. **Mock Storage** → **Database**: Replace `_lib/mock-storage.ts` with DB queries
2. **In-Memory** → **Redis**: Add caching layer for hot balances
3. **Sync** → **Async**: Add message queue for high-volume grant/spend operations

### Recommended Additions
1. **Authentication**: Add auth middleware to protect endpoints
2. **Rate Limiting**: Prevent abuse of grant/spend endpoints
3. **Audit Logging**: Log all grant/spend operations
4. **Real-time Updates**: WebSocket support for live balance changes
5. **Batch Operations**: Bulk grants/spends for efficiency

## Performance Considerations

### Catalog Operations
- **Lightweight**: Simple Map operations, O(1) for most operations
- **Scalable**: 30-item limit prevents unbounded growth
- **Cacheable**: Creator catalogs change infrequently

### Balance Operations
- **Frequent**: Grants/spends happen often during streams
- **Hot Data**: Active viewers have frequently accessed balances
- **Atomic**: Balance updates are atomic (no race conditions in current impl)

## Security Considerations

### Current Implementation
- No authentication (per requirements)
- No authorization (anyone can modify any catalog/balance)
- Input validation on all endpoints
- No persistent storage (in-memory only)

### For Production
1. Add user authentication
2. Implement creator authorization (only owners can modify their catalog)
3. Add CSRF protection
4. Implement rate limiting
5. Add audit logging
6. Use HTTPS in production

## Development Notes

### File Structure
```
channel-points/
├── _lib/                    # Shared libraries
│   ├── types.ts            # Type definitions
│   └── mock-storage.ts     # In-memory storage
├── catalog/                # Catalog endpoints
│   ├── route.ts           # GET/POST
│   └── [id]/route.ts      # PATCH/DELETE
├── balance/               # Balance endpoints
│   ├── route.ts          # GET/POST /grant
│   └── spend/route.ts    # POST /spend
├── __tests__/            # Test files
├── README.md             # Documentation
└── *.md                  # Additional docs
```

### Dependencies
- **Zero external dependencies** within the module
- **Next.js/TypeScript** only for route handling
- **Self-contained** for easy extraction/modification

### Code Style
- Follows existing project patterns
- Type-safe with proper interfaces
- Consistent error handling
- Comprehensive test coverage