import type { CatalogItem, Balance } from "./types";

// In-memory mock storage
const catalogItems = new Map<string, CatalogItem>();
const balances = new Map<string, Balance>();

// Helper to generate unique IDs
let catalogIdCounter = 1;
function generateCatalogId(): string {
  return `catalog_${catalogIdCounter++}_${Date.now()}`;
}

// Helper to get balance key
function getBalanceKey(viewerId: string, creatorId: string): string {
  return `${viewerId}:${creatorId}`;
}

// Initialize with some mock data
function initializeMockData(): void {
  // Add some sample catalog items
  const sampleCatalogItems: CatalogItem[] = [
    {
      id: generateCatalogId(),
      creator_id: "creator_123",
      name: "Custom Emote",
      cost: 500,
      cooldown_seconds: 3600,
      enabled: true,
      created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: generateCatalogId(),
      creator_id: "creator_123",
      name: "Shoutout",
      cost: 1000,
      cooldown_seconds: 7200,
      enabled: true,
      created_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
      updated_at: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: generateCatalogId(),
      creator_id: "creator_456",
      name: "Play a Song",
      cost: 2000,
      cooldown_seconds: 1800,
      enabled: true,
      created_at: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
      updated_at: new Date(Date.now() - 259200000).toISOString(),
    },
  ];

  sampleCatalogItems.forEach(item => {
    catalogItems.set(item.id, item);
  });

  // Add some sample balances
  const sampleBalances: Balance[] = [
    {
      viewer_id: "viewer_789",
      creator_id: "creator_123",
      balance: 2500,
      lifetime_earned: 5000,
      created_at: new Date(Date.now() - 604800000).toISOString(), // 1 week ago
      updated_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    },
    {
      viewer_id: "viewer_789",
      creator_id: "creator_456",
      balance: 1500,
      lifetime_earned: 3000,
      created_at: new Date(Date.now() - 1209600000).toISOString(), // 2 weeks ago
      updated_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    },
    {
      viewer_id: "viewer_999",
      creator_id: "creator_123",
      balance: 10000,
      lifetime_earned: 15000,
      created_at: new Date(Date.now() - 2592000000).toISOString(), // 1 month ago
      updated_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    },
  ];

  sampleBalances.forEach(balance => {
    const key = getBalanceKey(balance.viewer_id, balance.creator_id);
    balances.set(key, balance);
  });
}

// Initialize mock data
initializeMockData();

// Catalog operations
export const catalogStorage = {
  // Get all catalog items for a creator
  getByCreator(creatorId: string): CatalogItem[] {
    return Array.from(catalogItems.values())
      .filter(item => item.creator_id === creatorId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  // Get a single catalog item
  getById(id: string): CatalogItem | undefined {
    return catalogItems.get(id);
  },

  // Create a new catalog item
  create(item: Omit<CatalogItem, "id" | "created_at" | "updated_at">): CatalogItem {
    const creatorItems = this.getByCreator(item.creator_id);
    if (creatorItems.length >= 30) {
      throw new Error("Maximum catalog items limit reached (30 items per creator)");
    }

    const now = new Date().toISOString();
    const newItem: CatalogItem = {
      ...item,
      id: generateCatalogId(),
      created_at: now,
      updated_at: now,
    };

    catalogItems.set(newItem.id, newItem);
    return newItem;
  },

  // Update a catalog item
  update(id: string, updates: Partial<Omit<CatalogItem, "id" | "creator_id" | "created_at" | "updated_at">>): CatalogItem | undefined {
    const item = catalogItems.get(id);
    if (!item) {
      return undefined;
    }

    const updatedItem: CatalogItem = {
      ...item,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    catalogItems.set(id, updatedItem);
    return updatedItem;
  },

  // Delete a catalog item
  delete(id: string): boolean {
    return catalogItems.delete(id);
  },

  // Count items for a creator
  countByCreator(creatorId: string): number {
    return this.getByCreator(creatorId).length;
  },
};

// Balance operations
export const balanceStorage = {
  // Get balance for viewer/creator pair
  get(viewerId: string, creatorId: string): Balance | undefined {
    const key = getBalanceKey(viewerId, creatorId);
    return balances.get(key);
  },

  // Get or create balance for viewer/creator pair
  getOrCreate(viewerId: string, creatorId: string): Balance {
    const key = getBalanceKey(viewerId, creatorId);
    let balance = balances.get(key);

    if (!balance) {
      const now = new Date().toISOString();
      balance = {
        viewer_id: viewerId,
        creator_id: creatorId,
        balance: 0,
        lifetime_earned: 0,
        created_at: now,
        updated_at: now,
      };
      balances.set(key, balance);
    }

    return balance;
  },

  // Grant points to a viewer
  grant(viewerId: string, creatorId: string, amount: number): Balance {
    if (amount <= 0) {
      throw new Error("Grant amount must be positive");
    }

    const balance = this.getOrCreate(viewerId, creatorId);
    const now = new Date().toISOString();

    const updatedBalance: Balance = {
      ...balance,
      balance: balance.balance + amount,
      lifetime_earned: balance.lifetime_earned + amount,
      updated_at: now,
    };

    const key = getBalanceKey(viewerId, creatorId);
    balances.set(key, updatedBalance);
    return updatedBalance;
  },

  // Spend points from a viewer
  spend(viewerId: string, creatorId: string, amount: number): Balance {
    if (amount <= 0) {
      throw new Error("Spend amount must be positive");
    }

    const balance = this.get(viewerId, creatorId);
    if (!balance) {
      throw new Error("No balance found for viewer/creator pair");
    }

    if (balance.balance < amount) {
      throw new Error("Insufficient balance");
    }

    const now = new Date().toISOString();
    const updatedBalance: Balance = {
      ...balance,
      balance: balance.balance - amount,
      updated_at: now,
    };

    const key = getBalanceKey(viewerId, creatorId);
    balances.set(key, updatedBalance);
    return updatedBalance;
  },
};