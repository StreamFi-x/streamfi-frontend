# Channel Points System

This module implements a mock Channel Points system with two main components:
1. Creator Redemption Catalog
2. Viewer Channel Points Balance

## API Endpoints

### Catalog Management

#### GET `/api/routes-f/channel-points/catalog?creator_id={creatorId}`
Returns all catalog items for a creator.

**Response:**
```json
{
  "data": [
    {
      "id": "catalog_1_1234567890",
      "creator_id": "creator_123",
      "name": "Custom Emote",
      "cost": 500,
      "cooldown_seconds": 3600,
      "enabled": true,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### POST `/api/routes-f/channel-points/catalog`
Creates a new catalog item.

**Request Body:**
```json
{
  "creator_id": "creator_123",
  "name": "Custom Emote",
  "cost": 500,
  "cooldown_seconds": 3600,
  "enabled": true
}
```

**Constraints:**
- Maximum 30 items per creator
- `cost` must be positive
- `cooldown_seconds` must be non-negative
- `name` must be non-empty

#### PATCH `/api/routes-f/channel-points/catalog/{id}`
Updates a catalog item.

**Request Body:**
```json
{
  "name": "Updated Name",
  "cost": 1000,
  "cooldown_seconds": 7200,
  "enabled": false
}
```

#### DELETE `/api/routes-f/channel-points/catalog/{id}`
Deletes a catalog item.

### Balance Management

#### GET `/api/routes-f/channel-points/balance?viewer_id={viewerId}&creator_id={creatorId}`
Returns the balance for a viewer/creator pair.

**Response:**
```json
{
  "data": {
    "viewer_id": "viewer_789",
    "creator_id": "creator_123",
    "balance": 2500,
    "lifetime_earned": 5000,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

#### POST `/api/routes-f/channel-points/balance/grant`
Grants points to a viewer.

**Request Body:**
```json
{
  "viewer_id": "viewer_789",
  "creator_id": "creator_123",
  "amount": 1000,
  "reason": "Welcome bonus"
}
```

**Response includes:**
```json
{
  "data": { /* balance object */ },
  "message": "Successfully granted 1000 points",
  "details": { "reason": "Welcome bonus" }
}
```

#### POST `/api/routes-f/channel-points/balance/spend`
Spends points from a viewer.

**Request Body:**
```json
{
  "viewer_id": "viewer_789",
  "creator_id": "creator_123",
  "amount": 500,
  "item": "Custom Emote"
}
```

**Constraints:**
- Balance must be sufficient
- `amount` must be positive
- `item` must be non-empty string

**Response includes:**
```json
{
  "data": { /* balance object */ },
  "message": "Successfully spent 500 points",
  "details": { "item": "Custom Emote" }
}
```

## Data Models

### Catalog Item
```typescript
{
  id: string;
  creator_id: string;
  name: string;
  cost: number;
  cooldown_seconds: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}
```

### Balance
```typescript
{
  viewer_id: string;
  creator_id: string;
  balance: number;
  lifetime_earned: number;
  created_at: string;
  updated_at: string;
}
```

## Mock Storage

The implementation uses in-memory mock storage that:
- Persists only during server runtime
- Includes sample data for testing
- Can be easily replaced with a real database
- Enforces business rules (30 item limit, no negative balances)

## Testing

Run tests with:
```bash
npm test -- app/api/routes-f/channel-points
```

Test coverage includes:
- Catalog CRUD operations
- 30-item limit enforcement
- Balance retrieval
- Point grants and spends
- Insufficient balance protection
- Lifetime earned tracking

## Integration Notes

This is a self-contained MVP implementation. To integrate with a real backend:

1. Replace `_lib/mock-storage.ts` with database queries
2. Add authentication middleware
3. Add rate limiting
4. Add proper error handling and logging
5. Add caching layer for frequently accessed balances

The API structure is designed to be production-ready while using mock data for development.