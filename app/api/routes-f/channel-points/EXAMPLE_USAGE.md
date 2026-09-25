# Example Usage

## Catalog Management Examples

### Get Creator's Catalog
```bash
curl "http://localhost:3000/api/routes-f/channel-points/catalog?creator_id=creator_123"
```

### Create New Catalog Item
```bash
curl -X POST http://localhost:3000/api/routes-f/channel-points/catalog \
  -H "Content-Type: application/json" \
  -d '{
    "creator_id": "creator_123",
    "name": "Custom Emote",
    "cost": 500,
    "cooldown_seconds": 3600,
    "enabled": true
  }'
```

### Update Catalog Item
```bash
curl -X PATCH http://localhost:3000/api/routes-f/channel-points/catalog/catalog_1_1234567890 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Emote",
    "cost": 750
  }'
```

### Delete Catalog Item
```bash
curl -X DELETE http://localhost:3000/api/routes-f/channel-points/catalog/catalog_1_1234567890
```

## Balance Management Examples

### Get Viewer Balance
```bash
curl "http://localhost:3000/api/routes-f/channel-points/balance?viewer_id=viewer_789&creator_id=creator_123"
```

### Grant Points to Viewer
```bash
curl -X POST http://localhost:3000/api/routes-f/channel-points/balance/grant \
  -H "Content-Type: application/json" \
  -d '{
    "viewer_id": "viewer_789",
    "creator_id": "creator_123",
    "amount": 1000,
    "reason": "Welcome bonus"
  }'
```

### Spend Points
```bash
curl -X POST http://localhost:3000/api/routes-f/channel-points/balance/spend \
  -H "Content-Type: application/json" \
  -d '{
    "viewer_id": "viewer_789",
    "creator_id": "creator_123",
    "amount": 500,
    "item": "Custom Emote"
  }'
```

## JavaScript/TypeScript Examples

### Using Fetch API
```javascript
// Get catalog
async function getCatalog(creatorId) {
  const response = await fetch(
    `/api/routes-f/channel-points/catalog?creator_id=${creatorId}`
  );
  const data = await response.json();
  return data.data;
}

// Grant points
async function grantPoints(viewerId, creatorId, amount, reason) {
  const response = await fetch(
    '/api/routes-f/channel-points/balance/grant',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        viewer_id: viewerId,
        creator_id: creatorId,
        amount,
        reason
      })
    }
  );
  return await response.json();
}

// Spend points
async function spendPoints(viewerId, creatorId, amount, item) {
  const response = await fetch(
    '/api/routes-f/channel-points/balance/spend',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        viewer_id: viewerId,
        creator_id: creatorId,
        amount,
        item
      })
    }
  );
  return await response.json();
}
```

### Error Handling Example
```javascript
try {
  const result = await spendPoints('viewer_789', 'creator_123', 5000, 'Expensive Item');
  console.log('Spent points:', result);
} catch (error) {
  if (error.message.includes('Insufficient balance')) {
    console.log('Not enough points!');
  } else if (error.message.includes('not found')) {
    console.log('Balance not found');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Sample Responses

### Successful Catalog Creation (201)
```json
{
  "data": {
    "id": "catalog_42_1730487600000",
    "creator_id": "creator_123",
    "name": "Custom Emote",
    "cost": 500,
    "cooldown_seconds": 3600,
    "enabled": true,
    "created_at": "2024-11-02T10:00:00.000Z",
    "updated_at": "2024-11-02T10:00:00.000Z"
  },
  "message": "Catalog item created successfully"
}
```

### Insufficient Balance Error (400)
```json
{
  "error": "Insufficient balance"
}
```

### Catalog Limit Reached (400)
```json
{
  "error": "Maximum catalog items limit reached (30 items per creator)"
}
```

### Validation Error (400)
```json
{
  "error": "cost must be a positive number"
}
```

### Not Found Error (404)
```json
{
  "error": "Catalog item not found"
}
```

## Testing the Implementation

Run the included tests:
```bash
# From project root
npm test -- app/api/routes-f/channel-points

# Or run specific test files
npm test -- app/api/routes-f/channel-points/__tests__/catalog.test.ts
npm test -- app/api/routes-f/channel-points/__tests__/balance.test.ts
```

## Integration Tips

1. **Replace mock storage** - Swap `_lib/mock-storage.ts` with database calls
2. **Add authentication** - Integrate with your auth system
3. **Add caching** - Cache frequently accessed balances
4. **Add logging** - Log grants/spends for auditing
5. **Add rate limiting** - Prevent abuse of grant/spend endpoints
6. **Add WebSocket support** - Real-time balance updates for live streams