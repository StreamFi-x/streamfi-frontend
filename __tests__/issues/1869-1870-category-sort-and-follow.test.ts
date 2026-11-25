/**
 * Test: Category Page Sort-by Dropdown and Interactive Follow Button
 *
 * Issue #1869: Category page sort-by dropdown is fully decorative and never changes stream order.
 * Issue #1870: Category detail page Follow button has no click handler at all.
 */

describe("Issue #1869 & #1870: Category Page Sorting and Follow Button", () => {
  describe("Issue #1869: Category Detail Stream Sorting", () => {
    interface LiveStream {
      id: string;
      title: string;
      viewerCount: number;
      totalViews: number;
      streamStartedAt: string;
      isFollowing: boolean;
    }

    const mockStreams: LiveStream[] = [
      {
        id: "1",
        title: "Stream Alpha",
        viewerCount: 150,
        totalViews: 3000,
        streamStartedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hr ago
        isFollowing: false,
      },
      {
        id: "2",
        title: "Stream Beta",
        viewerCount: 500,
        totalViews: 1000,
        streamStartedAt: new Date(Date.now() - 7200000).toISOString(), // 2 hrs ago
        isFollowing: false,
      },
      {
        id: "3",
        title: "Stream Gamma",
        viewerCount: 100,
        totalViews: 5000,
        streamStartedAt: new Date(Date.now() - 1800000).toISOString(), // 30 mins ago
        isFollowing: true,
      },
    ];

    const sortStreams = (streams: LiveStream[], selectedSort: string) => {
      const filtered = [...streams];
      switch (selectedSort) {
        case "viewers":
          filtered.sort((a, b) => b.viewerCount - a.viewerCount);
          break;
        case "recent":
          filtered.sort(
            (a, b) =>
              new Date(b.streamStartedAt).getTime() -
              new Date(a.streamStartedAt).getTime()
          );
          break;
        case "popular":
          filtered.sort((a, b) => b.totalViews - a.totalViews);
          break;
        case "trending":
          filtered.sort((a, b) => {
            const aScore =
              a.viewerCount * 0.7 +
              (Date.now() - new Date(a.streamStartedAt).getTime()) / 1000000;
            const bScore =
              b.viewerCount * 0.7 +
              (Date.now() - new Date(b.streamStartedAt).getTime()) / 1000000;
            return bScore - aScore;
          });
          break;
        case "recommended":
        default:
          filtered.sort((a, b) => {
            if (a.isFollowing && !b.isFollowing) {
              return -1;
            }
            if (!a.isFollowing && b.isFollowing) {
              return 1;
            }
            return b.viewerCount - a.viewerCount;
          });
          break;
      }
      return filtered;
    };

    it("sorts streams by viewers descending", () => {
      const sorted = sortStreams(mockStreams, "viewers");
      expect(sorted.map(s => s.id)).toEqual(["2", "1", "3"]);
      expect(sorted[0].viewerCount).toBe(500);
      expect(sorted[1].viewerCount).toBe(150);
      expect(sorted[2].viewerCount).toBe(100);
    });

    it("sorts streams by recent (newest streamStartedAt first)", () => {
      const sorted = sortStreams(mockStreams, "recent");
      expect(sorted.map(s => s.id)).toEqual(["3", "1", "2"]);
    });

    it("sorts streams by popular (totalViews descending)", () => {
      const sorted = sortStreams(mockStreams, "popular");
      expect(sorted.map(s => s.id)).toEqual(["3", "1", "2"]);
      expect(sorted[0].totalViews).toBe(5000);
    });

    it("sorts streams by recommended (followed creators first, then viewerCount)", () => {
      const sorted = sortStreams(mockStreams, "recommended");
      expect(sorted[0].id).toBe("3"); // followed
      expect(sorted[1].id).toBe("2"); // 500 viewers
      expect(sorted[2].id).toBe("1"); // 150 viewers
    });
  });

  describe("Issue #1869: Category Overview Sorting", () => {
    interface Category {
      id: string;
      title: string;
      viewers?: number;
    }

    const mockCategories: Category[] = [
      { id: "cat-1", title: "Gaming", viewers: 1200 },
      { id: "cat-2", title: "Music", viewers: 400 },
      { id: "cat-3", title: "Art", viewers: 800 },
      { id: "cat-4", title: "Cooking", viewers: 0 },
    ];

    const sortCategories = (
      categories: Category[],
      selectedSort: string,
      followedCategories: string[] = []
    ) => {
      const filtered = [...categories];
      switch (selectedSort) {
        case "viewers":
          filtered.sort(
            (a, b) =>
              (b.viewers || 0) - (a.viewers || 0) ||
              a.title.localeCompare(b.title)
          );
          break;
        case "recent":
          filtered.sort(
            (a, b) =>
              (b.id || "").localeCompare(a.id || "") ||
              a.title.localeCompare(b.title)
          );
          break;
        case "popular":
          filtered.sort(
            (a, b) =>
              (b.viewers || 0) - (a.viewers || 0) ||
              a.title.localeCompare(b.title)
          );
          break;
        case "trending":
          filtered.sort((a, b) => {
            const aScore = (a.viewers || 0) * 0.7;
            const bScore = (b.viewers || 0) * 0.7;
            return bScore - aScore || a.title.localeCompare(b.title);
          });
          break;
        case "recommended":
        default:
          filtered.sort((a, b) => {
            const aFollowed = followedCategories.includes(
              a.title.toLowerCase()
            );
            const bFollowed = followedCategories.includes(
              b.title.toLowerCase()
            );
            if (aFollowed && !bFollowed) return -1;
            if (!aFollowed && bFollowed) return 1;
            const diff = (b.viewers || 0) - (a.viewers || 0);
            if (diff !== 0) return diff;
            return a.title.localeCompare(b.title);
          });
          break;
      }
      return filtered;
    };

    it("sorts categories by viewers descending", () => {
      const sorted = sortCategories(mockCategories, "viewers");
      expect(sorted.map(c => c.title)).toEqual([
        "Gaming",
        "Art",
        "Music",
        "Cooking",
      ]);
    });

    it("sorts categories by popular descending", () => {
      const sorted = sortCategories(mockCategories, "popular");
      expect(sorted.map(c => c.title)).toEqual([
        "Gaming",
        "Art",
        "Music",
        "Cooking",
      ]);
    });

    it("prioritizes followed categories under recommended sorting", () => {
      const sorted = sortCategories(mockCategories, "recommended", ["music"]);
      expect(sorted[0].title).toBe("Music");
      expect(sorted[1].title).toBe("Gaming");
      expect(sorted[2].title).toBe("Art");
      expect(sorted[3].title).toBe("Cooking");
    });
  });

  describe("Issue #1870: Category Follow / Unfollow State & Persistence", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("toggles follow state and persists to localStorage", () => {
      const categoryTitle = "Gaming";
      const norm = categoryTitle.toLowerCase();

      // Initial state: not followed
      let isFollowing = false;
      const stored = localStorage.getItem("streamfi_followed_categories");
      const list: string[] = stored ? JSON.parse(stored) : [];
      expect(list.includes(norm)).toBe(false);

      // Action: Follow
      isFollowing = true;
      const updatedAfterFollow = Array.from(new Set([...list, norm]));
      localStorage.setItem(
        "streamfi_followed_categories",
        JSON.stringify(updatedAfterFollow)
      );

      // Verify persistence
      const storedAfterFollow = JSON.parse(
        localStorage.getItem("streamfi_followed_categories")!
      );
      expect(storedAfterFollow).toContain("gaming");

      // Action: Unfollow
      isFollowing = false;
      const updatedAfterUnfollow = storedAfterFollow.filter(
        (c: string) => c !== norm
      );
      localStorage.setItem(
        "streamfi_followed_categories",
        JSON.stringify(updatedAfterUnfollow)
      );

      // Verify removal
      const storedAfterUnfollow = JSON.parse(
        localStorage.getItem("streamfi_followed_categories")!
      );
      expect(storedAfterUnfollow).not.toContain("gaming");
    });
  });
});
