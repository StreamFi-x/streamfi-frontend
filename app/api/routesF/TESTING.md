# Testing the StreamFi Frontend API

## Overview
The implementation includes comprehensive test suites for all four API features. Tests are written using Jest and are fully self-contained within the `app/api/routesF/` directory.

## Test Structure

```
app/api/routesF/tests/
├── viewer-birthday/
│   └── viewer-birthday.test.ts     # 20+ tests covering GET, PUT, DELETE
├── viewer-follow-age/
│   └── viewer-follow-age.test.ts   # 10+ tests covering follow age calculations
├── creator-verification/
│   └── creator-verification.test.ts # 20+ tests covering GET, POST, validation
└── viewer-color-blind/
    └── viewer-color-blind.test.ts   # 20+ tests covering GET, PUT, validation
```

## Running Tests

### Prerequisites
Ensure you have Jest installed globally or locally:
```bash
npm install --save-dev jest @types/jest ts-jest
```

### Running All Tests
```bash
# From the routesF directory
cd app/api/routesF
npx jest

# Or from project root
npx jest app/api/routesF/tests
```

### Running Specific Test Suites
```bash
# Birthday configuration tests
npx jest viewer-birthday

# Follow age tests
npx jest viewer-follow-age

# Verification tests
npx jest creator-verification

# Color blind tests
npx jest viewer-color-blind
```

### Running with Coverage
```bash
npx jest --coverage
```

## Test Categories

### 1. Viewer Birthday Tests ✅
**Validation Tests:**
- ✓ Invalid date format rejection
- ✓ Future date rejection
- ✓ Age validation (13+ years minimum)
- ✓ Required field validation

**CRUD Tests:**
- ✓ Create new birthday configuration
- ✓ Update existing configuration
- ✓ Delete configuration
- ✓ Get configuration with/without birthday

**Edge Cases:**
- ✓ Missing configuration (404)
- ✓ Empty viewer_id (400)
- ✓ Invalid JSON body (400)

### 2. Viewer Follow Age Tests ✅
**Calculation Tests:**
- ✓ Follow count aggregation
- ✓ Average age calculation
- ✓ Oldest follow identification
- ✓ Single follow handling

**Edge Cases:**
- ✓ Viewer with no follows
- ✓ Very old follows
- ✓ Mixed follow dates
- ✓ Empty viewer_id (400)

### 3. Creator Verification Tests ✅
**Request Tests:**
- ✓ Create new verification request
- ✓ Get request status
- ✓ Duplicate pending request prevention (409)
- ✓ Unique request ID generation

**Validation Tests:**
- ✓ Method enum validation
- ✓ Proof link URL validation
- ✓ Minimum/maximum proof links
- ✓ Empty proof links array

**Security Tests:**
- ✓ Proof links not exposed in GET responses
- ✓ Request ID format validation
- ✓ Status transition handling

### 4. Viewer Color Blind Tests ✅
**Preference Tests:**
- ✓ Get existing preference
- ✓ Create new preference
- ✓ Update existing preference
- ✓ All color mode support

**Validation Tests:**
- ✓ Mode enum validation
- ✓ Required field validation
- ✓ Invalid mode rejection
- ✓ Empty viewer_id handling

**Persistence Tests:**
- ✓ Separate preferences per viewer
- ✓ Timestamp updates
- ✓ Preference persistence

## Test Patterns

### Mock Repository Reset
Each test suite resets repositories before each test:
```typescript
beforeEach(() => {
  birthdayRepository.clear();
});
```

### Request Creation Helpers
Each test file includes helper functions:
```typescript
function createGetRequest(viewerId: string): NextRequest {
  return new NextRequest(`http://localhost/api/routesF/viewer-birthday?viewer_id=${viewerId}`);
}
```

### Response Assertions
Tests verify both HTTP status codes and response structure:
```typescript
expect(response.status).toBe(200);
const data = await response.json();
expect(data.success).toBe(true);
expect(data.data).toEqual({
  birthday_iso: '1995-03-15',
  share_with_creators: true,
});
```

## Test Data

### Seed Data
Tests use realistic mock data:
- **Viewer IDs**: `vwr_gaming_fan_001`, `vwr_music_lover_002`, etc.
- **Creator IDs**: `crt_gaming_pro_101`, `crt_music_maestro_102`, etc.
- **Follow dates**: Realistic timestamps for age calculations
- **Birthday dates**: Valid dates with age considerations
- **Color modes**: All supported color blindness modes

### Deterministic Testing
- Dates are calculated relative to current time
- IDs follow deterministic patterns
- No reliance on external services
- Tests are timezone-agnostic

## Edge Case Coverage

### Date Validation
```typescript
// Test future date rejection
birthday_iso: '2050-01-01' // Should be rejected

// Test very old date
birthday_iso: '1800-01-01' // Should be rejected

// Test minimum age
birthday_iso: `${currentYear - 10}-01-01` // Should be rejected (age < 13)
```

### Enum Validation
```typescript
// Invalid verification method
method: 'invalid_method' // Should be rejected

// Invalid color mode
mode: 'invalid_mode' // Should be rejected
```

### Array Validation
```typescript
// Empty proof links
proof_links: [] // Should be rejected

// Too many proof links
proof_links: Array.from({ length: 15 }, (_, i) => `https://example.com/${i}`) // Should be rejected
```

## Continuous Integration

### Recommended CI Configuration
```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx jest app/api/routesF/tests --coverage
```

### Test Coverage Goals
- **Line Coverage**: > 90%
- **Branch Coverage**: > 85%
- **Function Coverage**: > 95%
- **Statement Coverage**: > 90%

## Debugging Tests

### Running Specific Tests
```bash
# Run a single test
npx jest -t "creates new birthday configuration"

# Run tests matching a pattern
npx jest -t "validation"

# Run tests in watch mode
npx jest --watch
```

### Verbose Output
```bash
npx jest --verbose
```

### Debugging Failed Tests
1. Check HTTP status codes match expectations
2. Verify response JSON structure
3. Check repository state after operations
4. Validate date calculations
5. Verify enum validation is working

## Adding New Tests

### Test Template
```typescript
describe('New Feature API', () => {
  beforeEach(() => {
    repository.clear();
  });

  describe('GET /api/routesF/new-feature', () => {
    it('returns expected data', async () => {
      // Setup
      repository.save(testData);
      
      // Execute
      const request = createGetRequest('test_id');
      const response = await GET(request);
      
      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual(expectedData);
    });

    it('handles edge cases', async () => {
      // Test edge case
    });
  });
});
```

### Test Best Practices
1. **One assertion per test** - Tests should verify one behavior
2. **Clear test names** - Describe what the test verifies
3. **Independent tests** - Tests should not depend on each other
4. **Realistic data** - Use realistic mock data
5. **Edge case coverage** - Test boundaries and error conditions

## Test Performance

### Fast Test Execution
- Tests run in milliseconds
- No external dependencies
- In-memory repositories
- Deterministic operations

### Memory Management
- Repository clearing between tests
- No memory leaks
- Clean test isolation
- Proper cleanup

## Conclusion

The test suites provide comprehensive coverage of all API features, validation rules, edge cases, and error conditions. Tests are fast, deterministic, and fully self-contained within the routesF directory structure.