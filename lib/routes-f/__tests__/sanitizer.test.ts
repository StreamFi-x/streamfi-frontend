import { sanitizeString, sanitizeObject } from "../sanitizer";

describe("Routes-F Sanitizer", () => {
    describe("sanitizeString", () => {
        it("should trim whitespace", () => {
            expect(sanitizeString("  hello world  ")).toBe("hello world");
        });

        it("should normalize multiple spaces and newlines", () => {
            expect(sanitizeString("hello\n\nworld    test")).toBe("hello world test");
        });

        it("should remove HTML tags", () => {
            expect(sanitizeString("<div>Hello</div><p>World</p>")).toBe("Hello World");
        });

        it("should remove script tags and their content", () => {
            expect(sanitizeString("<script>alert('xss')</script>Safe Content")).toBe("Safe Content");
            expect(sanitizeString("Safe<script src='evil.js'></script>Content")).toBe("Safe Content");
            expect(sanitizeString("<script >alert('xss')</script >Safe")).toBe("Safe");
        });

        it("should handle nested tag bypasses", () => {
            expect(sanitizeString("<scr<script>ipt>alert(1)</script>")).toBe("alert(1)");
            expect(sanitizeString("<<script>script>alert(1)</</script>script>")).toBe("alert(1)");
        });

        it("should handle very malformed closing script tags", () => {
            expect(sanitizeString("Text<script>alert(1)</script\t\n bar>More")).toBe("TextMore");
        });

        it("should handle orphaned script starts", () => {
            expect(sanitizeString("<script alert(1)")).toBe("alert(1)");
        });

        it("should handle mixed HTML and script tags", () => {
            const input = "  <div class='test'>  Text  <script>console.log(1)</script>  <b>More</b>  </div>  ";
            expect(sanitizeString(input)).toBe("Text More");
        });

        it("should handle null and undefined", () => {
            expect(sanitizeString(null as any)).toBe("");
            expect(sanitizeString(undefined as any)).toBe("");
        });
    });

    describe("sanitizeObject", () => {
        it("should sanitize all string properties in an object", () => {
            const input = {
                title: "  <h1>Title</h1>  ",
                meta: {
                    description: "<i>Desc</i>\n\nTest",
                    tags: ["<b>tag1</b>", "  tag2  "]
                }
            };

            const expected = {
                title: "Title",
                meta: {
                    description: "Desc Test",
                    tags: ["tag1", "tag2"]
                }
            };

            expect(sanitizeObject(input)).toEqual(expected);
        });

        it("should handle arrays of objects", () => {
            const input = [
                { name: "<p>Alice</p>", age: 30 },
                { name: "<b>Bob</b>", age: 25 }
            ];

            const expected = [
                { name: "Alice", age: 30 },
                { name: "Bob", age: 25 }
            ];

            expect(sanitizeObject(input)).toEqual(expected);
        });

        it("should not affect non-string properties", () => {
            const input = {
                count: 123,
                active: true,
                data: null,
                date: new Date(2025, 0, 1)
            };

            const original = { ...input };
            expect(sanitizeObject(input)).toEqual(original);
        });
    });
});
