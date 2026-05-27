import { convertCase, splitWords } from "../route";

describe("splitWords", () => {
  it("detects each source case", () => {
    expect(splitWords("foo_bar_baz")).toEqual(["foo", "bar", "baz"]);
    expect(splitWords("foo-bar-baz")).toEqual(["foo", "bar", "baz"]);
    expect(splitWords("fooBarBaz")).toEqual(["foo", "bar", "baz"]);
    expect(splitWords("FooBarBaz")).toEqual(["foo", "bar", "baz"]);
  });

  it("preserves embedded numbers", () => {
    expect(splitWords("apiV2Client")).toEqual(["api", "v2", "client"]);
  });
});

describe("convertCase", () => {
  const cases: Array<[string, CaseTargetLike]> = [];
  type CaseTargetLike = "snake" | "camel" | "pascal" | "kebab";

  it("converts mixed-case input to each target", () => {
    expect(convertCase("fooBarBaz", "snake")).toBe("foo_bar_baz");
    expect(convertCase("foo_bar_baz", "camel")).toBe("fooBarBaz");
    expect(convertCase("foo-bar-baz", "pascal")).toBe("FooBarBaz");
    expect(convertCase("FooBarBaz", "kebab")).toBe("foo-bar-baz");
    void cases;
  });

  it("keeps numbers in the right place", () => {
    expect(convertCase("apiV2Client", "snake")).toBe("api_v2_client");
    expect(convertCase("api_v2_client", "pascal")).toBe("ApiV2Client");
  });
});
