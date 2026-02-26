export interface Conflict {
    path: string;
    base: any;
    incoming: any;
}

/**
 * Analyzes conflicts between two payloads recursively.
 * Supports nested objects and ensures stable ordered output.
 */
export function analyzeConflicts(base: any, incoming: any, path = ""): Conflict[] {
    const conflicts: Conflict[] = [];

    // If one is not an object or null, compare directly
    if (
        typeof base !== "object" ||
        base === null ||
        typeof incoming !== "object" ||
        incoming === null
    ) {
        if (base !== incoming) {
            conflicts.push({ path: path || "(root)", base, incoming });
        }
        return conflicts;
    }

    // Handle arrays as atomic values for this implementation
    if (Array.isArray(base) || Array.isArray(incoming)) {
        if (JSON.stringify(base) !== JSON.stringify(incoming)) {
            conflicts.push({ path: path || "(root)", base, incoming });
        }
        return conflicts;
    }

    // Get all unique keys and sort them for stable output
    const keys = Array.from(new Set([...Object.keys(base), ...Object.keys(incoming)])).sort();

    for (const key of keys) {
        const currentPath = path ? `${path}.${key}` : key;
        const baseValue = base[key];
        const incomingValue = incoming[key];

        // If values are strictly equal, no conflict for this key
        if (baseValue === incomingValue) {
            continue;
        }

        // If both are objects (and not arrays), recurse
        if (
            typeof baseValue === "object" &&
            baseValue !== null &&
            typeof incomingValue === "object" &&
            incomingValue !== null &&
            !Array.isArray(baseValue) &&
            !Array.isArray(incomingValue)
        ) {
            conflicts.push(...analyzeConflicts(baseValue, incomingValue, currentPath));
        } else {
            // Primitive mismatch or one is an object and the other is not
            conflicts.push({ path: currentPath, base: baseValue, incoming: incomingValue });
        }
    }

    return conflicts;
}
