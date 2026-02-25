/**
 * Simple input sanitizer for Routes-F payloads.
 * Strips HTML tags, removes script content, and normalizes whitespace.
 * No heavy dependencies as per requirements.
 */

/**
 * Sanitizes a single string.
 * - Removes script tags and their content.
 * - Removes all other HTML tags.
 * - Normalizes multiple spaces/newlines to single ones.
 * - Trims leading/trailing whitespace.
 */
export function sanitizeString(input: string | null | undefined): string {
    if (input === null || input === undefined) {
        return "";
    }

    let sanitized = input;
    let previous;

    // Loop to handle nested tags like <scr<script>ipt>
    do {
        previous = sanitized;

        // 1. Remove script tags and their content (handling whitespace in closing tag)
        sanitized = sanitized.replace(
            /<script\b[^<]*(?:(?!<\/script\s*>)<[^<]*)*<\/script\s*>/gi,
            ""
        );

        // 2. Remove all other HTML tags
        sanitized = sanitized.replace(/<[^>]*>?/gm, "");

        // 3. Specifically remove orphaned <script if it remains
        sanitized = sanitized.replace(/<script/gi, "");
    } while (sanitized !== previous);

    // 4. Normalize whitespace (tabs, multiple spaces, multiple newlines)
    sanitized = sanitized.replace(/\s+/g, " ");

    // 5. Final trim
    return sanitized.trim();
}

/**
 * Recursively sanitizes string properties within an object or array.
 * Mutates the object in place but also returns it for convenience.
 */
export function sanitizeObject<T>(obj: T): T {
    if (!obj || typeof obj !== "object") {
        if (typeof obj === "string") {
            return sanitizeString(obj) as unknown as T;
        }
        return obj;
    }

    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            obj[i] = sanitizeObject(obj[i]);
        }
    } else {
        const record = obj as Record<string, any>;
        for (const key in record) {
            if (Object.prototype.hasOwnProperty.call(record, key)) {
                if (typeof record[key] === "string") {
                    record[key] = sanitizeString(record[key]);
                } else if (record[key] && typeof record[key] === "object") {
                    record[key] = sanitizeObject(record[key]);
                }
            }
        }
    }

    return obj;
}
