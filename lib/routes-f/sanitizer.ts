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

    // Loop to handle nested tags like <scr<script>ipt>.
    // We replace matched parts with a space (" ") instead of an empty string
    // to prevent character "gluing", where stripping one tag creates another.
    // This addresses the "Incomplete multi-character sanitization" security alert.
    do {
        previous = sanitized;

        // 1. Remove script tags and their content.
        // The closing tag regex [^>]* handles cases like </script\t\n bar>
        // as reported by the "Bad HTML filtering regexp" check.
        sanitized = sanitized.replace(
            /<script\b[^>]*>([\s\S]*?)<\/script[^>]*>/gi,
            " "
        );

        // 2. Remove all other HTML tags.
        sanitized = sanitized.replace(/<[^>]+>/g, " ");

        // 3. Specifically remove orphaned <script tokens.
        sanitized = sanitized.replace(/<script/gi, " ");

        // 4. Remove all remaining brackets to ensure no tags can be constructed.
        sanitized = sanitized.replace(/[<>]/g, " ");
    } while (sanitized !== previous);

    // 5. Final normalization: collapse multiple spaces and trim.
    return sanitized.replace(/\s+/g, " ").trim();
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
