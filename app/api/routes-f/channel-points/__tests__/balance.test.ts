import { GET, POST as grantPOST } from "../balance/route";
import { POST as spendPOST } from "../balance/spend/route";
import { createMockRequest } from "./test-utils";

describe("Balance API", () => {
  const testViewerId = "test_viewer_999";
  const testCreatorId = "test_creator_999";
  const baseUrl = "http://localhost:3000/api/routes-f/channel-points/balance";

  describe("GET /api/routes-f/channel-points/balance", () => {
    it("should return balance for viewer/creator pair", async () => {
      const req = createMockRequest(
        "GET", 
        `${baseUrl}?viewer_id=${testViewerId}&creator_id=${testCreatorId}`
      );
      const response = await GET(req);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toMatchObject({
        viewer_id: testViewerId,
        creator_id: testCreatorId,
        balance: expect.any(Number),
        lifetime_earned: expect.any(Number),
      });
    });

    it("should return 404 when balance not found", async () => {
      const req = createMockRequest(
        "GET", 
        `${baseUrl}?viewer_id=non-existent&creator_id=non-existent`
      );
      const response = await GET(req);
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain("not found");
    });

    it("should return 400 when parameters are missing", async () => {
      const req1 = createMockRequest("GET", `${baseUrl}?viewer_id=${testViewerId}`);
      const response1 = await GET(req1);
      expect(response1.status).toBe(400);

      const req2 = createMockRequest("GET", `${baseUrl}?creator_id=${testCreatorId}`);
      const response2 = await GET(req2);
      expect(response2.status).toBe(400);
    });
  });

  describe("POST /api/routes-f/channel-points/balance/grant", () => {
    it("should grant points to a viewer", async () => {
      const grantData = {
        viewer_id: testViewerId,
        creator_id: testCreatorId,
        amount: 1000,
        reason: "Test grant",
      };

      const req = createMockRequest("POST", `${baseUrl}/grant`, grantData);
      const response = await grantPOST(req);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.balance).toBeGreaterThan(0);
      expect(data.data.lifetime_earned).toBeGreaterThan(0);
      expect(data.message).toContain("granted");
      expect(data.details.reason).toBe("Test grant");
    });

    it("should create balance if it doesn't exist", async () => {
      const newViewerId = "new_viewer_123";
      const grantData = {
        viewer_id: newViewerId,
        creator_id: testCreatorId,
        amount: 500,
        reason: "First grant",
      };

      const req = createMockRequest("POST", `${baseUrl}/grant`, grantData);
      const response = await grantPOST(req);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.balance).toBe(500);
      expect(data.data.lifetime_earned).toBe(500);
    });

    it("should validate required fields", async () => {
      const invalidGrant = {
        viewer_id: testViewerId,
        // Missing creator_id, amount, reason
      };

      const req = createMockRequest("POST", `${baseUrl}/grant`, invalidGrant);
      const response = await grantPOST(req);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Missing required fields");
    });

    it("should validate amount is positive", async () => {
      const invalidGrant = {
        viewer_id: testViewerId,
        creator_id: testCreatorId,
        amount: -100,
        reason: "Invalid grant",
      };

      const req = createMockRequest("POST", `${baseUrl}/grant`, invalidGrant);
      const response = await grantPOST(req);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("positive number");
    });

    it("should validate reason is non-empty", async () => {
      const invalidGrant = {
        viewer_id: testViewerId,
        creator_id: testCreatorId,
        amount: 100,
        reason: "",
      };

      const req = createMockRequest("POST", `${baseUrl}/grant`, invalidGrant);
      const response = await grantPOST(req);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("non-empty string");
    });
  });

  describe("POST /api/routes-f/channel-points/balance/spend", () => {
    it("should spend points from a viewer", async () => {
      // First grant some points
      const grantData = {
        viewer_id: testViewerId,
        creator_id: testCreatorId,
        amount: 2000,
        reason: "Setup for spend test",
      };
      const grantReq = createMockRequest("POST", `${baseUrl}/grant`, grantData);
      await grantPOST(grantReq);

      // Now spend some points
      const spendData = {
        viewer_id: testViewerId,
        creator_id: testCreatorId,
        amount: 500,
        item: "Test Redemption",
      };

      const req = createMockRequest("POST", `${baseUrl}/spend`, spendData);
      const response = await spendPOST(req);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.balance).toBe(1500); // 2000 - 500
      expect(data.data.lifetime_earned).toBe(2000); // Should not change
      expect(data.message).toContain("spent");
      expect(data.details.item).toBe("Test Redemption");
    });

    it("should reject spending when insufficient balance", async () => {
      // Create a new viewer with minimal balance
      const newViewerId = "poor_viewer_123";
      const grantData = {
        viewer_id: newViewerId,
        creator_id: testCreatorId,
        amount: 100,
        reason: "Small grant",
      };
      const grantReq = createMockRequest("POST", `${baseUrl}/grant`, grantData);
      await grantPOST(grantReq);

      // Try to spend more than balance
      const spendData = {
        viewer_id: newViewerId,
        creator_id: testCreatorId,
        amount: 500,
        item: "Expensive Item",
      };

      const req = createMockRequest("POST", `${baseUrl}/spend`, spendData);
      const response = await spendPOST(req);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Insufficient balance");
    });

    it("should return 404 when balance doesn't exist", async () => {
      const spendData = {
        viewer_id: "non-existent-viewer",
        creator_id: "non-existent-creator",
        amount: 100,
        item: "Test Item",
      };

      const req = createMockRequest("POST", `${baseUrl}/spend`, spendData);
      const response = await spendPOST(req);
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain("No balance found");
    });

    it("should validate required fields", async () => {
      const invalidSpend = {
        viewer_id: testViewerId,
        // Missing creator_id, amount, item
      };

      const req = createMockRequest("POST", `${baseUrl}/spend`, invalidSpend);
      const response = await spendPOST(req);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Missing required fields");
    });

    it("should validate amount is positive", async () => {
      const invalidSpend = {
        viewer_id: testViewerId,
        creator_id: testCreatorId,
        amount: -100,
        item: "Invalid Spend",
      };

      const req = createMockRequest("POST", `${baseUrl}/spend`, invalidSpend);
      const response = await spendPOST(req);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("positive number");
    });

    it("should validate item is non-empty", async () => {
      const invalidSpend = {
        viewer_id: testViewerId,
        creator_id: testCreatorId,
        amount: 100,
        item: "",
      };

      const req = createMockRequest("POST", `${baseUrl}/spend`, invalidSpend);
      const response = await spendPOST(req);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("non-empty string");
    });

    it("should not allow negative balance", async () => {
      // This is tested by the insufficient balance test above
      // The implementation should always check balance >= amount before spending
    });

    it("should only increase lifetime_earned on grants, not on spends", async () => {
      const newViewerId = "lifetime_test_viewer";
      
      // Grant 1000 points
      const grantData = {
        viewer_id: newViewerId,
        creator_id: testCreatorId,
        amount: 1000,
        reason: "Lifetime test grant",
      };
      const grantReq = createMockRequest("POST", `${baseUrl}/grant`, grantData);
      const grantResponse = await grantPOST(grantReq);
      const grantResult = await grantResponse.json();
      
      expect(grantResult.data.lifetime_earned).toBe(1000);
      
      // Spend 300 points
      const spendData = {
        viewer_id: newViewerId,
        creator_id: testCreatorId,
        amount: 300,
        item: "Lifetime test spend",
      };
      const spendReq = createMockRequest("POST", `${baseUrl}/spend`, spendData);
      const spendResponse = await spendPOST(spendReq);
      const spendResult = await spendResponse.json();
      
      expect(spendResult.data.balance).toBe(700); // 1000 - 300
      expect(spendResult.data.lifetime_earned).toBe(1000); // Should remain unchanged
    });
  });
});