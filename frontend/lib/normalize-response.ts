/**
 * Convert snake_case or kebab-case keys to camelCase recursively.
 * Handles objects, arrays, and primitive values.
 *
 * @example
 * normalizeResponse({ user_id: 1, full_name: "John" })
 * // => { userId: 1, fullName: "John" }
 */
export function normalizeResponse<T>(data: unknown): T {
    if (data === null || data === undefined) {
        return data as T;
    }

    if (Array.isArray(data)) {
        return data.map((item) => normalizeResponse(item)) as T;
    }

    if (typeof data !== "object") {
        return data as T;
    }

    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
        const camelKey = snakeToCamel(key);
        normalized[camelKey] = normalizeResponse(value);
    }

    return normalized as T;
}

/**
 * Convert a single snake_case/kebab-case string to camelCase.
 *
 * @example
 * snakeToCamel("user_id") // => "userId"
 * snakeToCamel("full-name") // => "fullName"
 * snakeToCamel("normalKey") // => "normalKey"
 */
export function snakeToCamel(str: string): string {
    return str.replace(/[-_]([a-z0-9])/g, (_, char) => char.toUpperCase());
}

/**
 * Convert camelCase to snake_case (inverse operation, useful for request payloads).
 *
 * @example
 * camelToSnake("userId") // => "user_id"
 * camelToSnake("fullName") // => "full_name"
 */
export function camelToSnake(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

/**
 * Recursively convert camelCase object keys to snake_case.
 * Useful for preparing request payloads to send to Python backend.
 *
 * @example
 * denormalizeRequest({ userId: 1, fullName: "John" })
 * // => { user_id: 1, full_name: "John" }
 */
export function denormalizeRequest<T>(data: unknown): T {
    if (data === null || data === undefined) {
        return data as T;
    }

    if (Array.isArray(data)) {
        return data.map((item) => denormalizeRequest(item)) as T;
    }

    if (typeof data !== "object") {
        return data as T;
    }

    const denormalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
        const snakeKey = camelToSnake(key);
        denormalized[snakeKey] = denormalizeRequest(value);
    }

    return denormalized as T;
}
