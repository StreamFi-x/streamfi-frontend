import { GET, POST } from "../catalog/route";
import { PATCH, DELETE } from "../catalog/[id]/route";
import { createMockRequest, createMockParams } from "./test-utils";

describe("Catalog API", () => {
  const testCreatorId = "test_creator_999";
  const baseUrl = "http://localhost:3000/api/routes-f/channel-points/catalog";

  describe("GET /api/routes-f/channel-points/catalog", () => {
    it("should return catalog items for a creator", async () => {
      const req = createMockRequest("GET", `${baseUrl}?creator_id=${testCreatorId}`);
      const response = await GET(req);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("data");
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("should return 400 when creator_id is missing", async () => {
      const req = createMockRequest("GET", baseUrl);
      const response = await GET(req);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("creator_id");
    });
  });

  describe("POST /api/routes-f/channel-points/catalog", () => {
    it("should create a new catalog item", async () => {
      const newItem = {
        creator_id: testCreatorId,
        name: "Test Redemption",
        cost: 500,
        cooldown_seconds: 3600,
        enabled: true,
      };

      const req = createMockRequest("POST", baseUrl, newItem);
      const response = await POST(req);
      
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.data).toMatchObject({
        creator_id: testCreatorId,
        name: "Test Redemption",
        cost: 500,
        cooldown_seconds: 3600,
        enabled: true,
      });
      expect(data.data.id).toBeDefined();
      expect(data.data.created_at).toBeDefined();
      expect(data.data.updated_at).toBeDefined();
    });

    it("should reject creation when max items reached", async () => {
      // Create 30 items for the same creator
      for (let i = 0; i < 30; i++) {
        const newItem = {
          creator_id: "max_limit_creator",
          name: `Item ${i}`,
          cost: 100,
          cooldown_seconds: 0,
        };
        const req = createMockRequest("POST", baseUrl, newItem);
        await POST(req);
      }

      // Try to create one more
      const extraItem = {
        creator_id: "max_limit_creator",
        name: "Extra Item",
        cost: 100,
        cooldown_seconds: 0,
      };
      const req = createMockRequest("POST", baseUrl, extraItem);
      const response = await POST(req);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Maximum catalog items limit reached");
    });

    it("should validate required fields", async () => {
      const invalidItem = {
        creator_id: testCreatorId,
        // Missing name, cost, cooldown_seconds
      };

      const req = createMockRequest("POST", baseUrl, invalidItem);
      const response = await POST(req);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Missing required fields");
    });

    it("should validate cost is positive", async () => {
      const invalidItem = {
        creator_id: testCreatorId,
        name: "Test Item",
        cost: -100,
        cooldown_seconds: 3600,
      };

      const req = createMockRequest("POST", baseUrl, invalidItem);
      const response = await POST(req);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("positive number");
    });

    it("should validate cooldown_seconds is non-negative", async () => {
      const invalidItem = {
        creator_id: testCreatorId,
        name: "Test Item",
        cost: 500,
        cooldown_seconds: -100,
      };

      const req = createMockRequest("POST", baseUrl, invalidItem);
      const response = await POST(req);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("non-negative number");
    });
  });

  describe("PATCH /api/routes-f/channel-points/catalog/[id]", () => {
    it("should update a catalog item", async () => {
      // First create an item
      const createItem = {
        creator_id: testCreatorId,
        name: "Original Name",
        cost: 500,
        cooldown_seconds: 3600,
      };
      const createReq = createMockRequest("POST", baseUrl, createItem);
      const createResponse = await POST(createReq);
      const createdItem = await createResponse.json();
      const itemId = createdItem.data.id;

      // Update the item
      const updates = {
        name: "Updated Name",
        cost: 1000,
        cooldown_seconds: 7200,
        enabled: false,
      };
      
      const patchReq = createMockRequest("PATCH", `${baseUrl}/${itemId}`, updates);
      const params = createMockParams({ id: itemId });
      const patchResponse = await PATCH(patchReq, { params });
      
      expect(patchResponse.status).toBe(200);
      const patchData = await patchResponse.json();
      expect(patchData.data).toMatchObject(updates);
      expect(patchData.data.updated_at).not.toBe(createdItem.data.updated_at);
    });

    it("should return 404 when item not found", async () => {
      const updates = {
        name: "Updated Name",
      };
      
      const req = createMockRequest("PATCH", `${baseUrl}/non-existent-id`, updates);
      const params = createMockParams({ id: "non-existent-id" });
      const response = await PATCH(req, { params });
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain("not found");
    });

    it("should validate update fields", async () => {
      // First create an item
      const createItem = {
        creator_id: testCreatorId,
        name: "Test Item",
        cost: 500,
        cooldown_seconds: 3600,
      };
      const createReq = createMockRequest("POST", baseUrl, createItem);
      const createResponse = await POST(createReq);
      const createdItem = await createResponse.json();
      const itemId = createdItem.data.id;

      // Try invalid update
      const invalidUpdates = {
        cost: -100,
      };
      
      const req = createMockRequest("PATCH", `${baseUrl}/${itemId}`, invalidUpdates);
      const params = createMockParams({ id: itemId });
      const response = await PATCH(req, { params });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("positive number");
    });
  });

  describe("DELETE /api/routes-f/channel-points/catalog/[id]", () => {
    it("should delete a catalog item", async () => {
      // First create an item
      const createItem = {
        creator_id: testCreatorId,
        name: "Item to Delete",
        cost: 500,
        cooldown_seconds: 3600,
      };
      const createReq = createMockRequest("POST", baseUrl, createItem);
      const createResponse = await POST(createReq);
      const createdItem = await createResponse.json();
      const itemId = createdItem.data.id;

      // Delete the item
      const req = createMockRequest("DELETE", `${baseUrl}/${itemId}`);
      const params = createMockParams({ id: itemId });
      const response = await DELETE(req, { params });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toContain("deleted successfully");

      // Verify it's deleted
      const verifyReq = createMockRequest("PATCH", `${baseUrl}/${itemId}`, { name: "Updated" });
      const verifyResponse = await PATCH(verifyReq, { params });
      expect(verifyResponse.status).toBe(404);
    });

    it("should return 404 when item not found", async () => {
      const req = createMockRequest("DELETE", `${baseUrl}/non-existent-id`);
      const params = createMockParams({ id: "non-existent-id" });
      const response = await DELETE(req, { params });
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain("not found");
    });
  });
});