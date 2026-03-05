import { normalizeResponse } from "@/lib/normalize-response";
import { createClient } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export class AuthFetchError extends Error {
    status: number;
    data: unknown;

    constructor(message: string, status: number, data?: unknown) {
        super(message);
        this.name = "AuthFetchError";
        this.status = status;
        this.data = data;
    }
}

export async function fetchWithAccessToken<T>(
    path: string,
    init?: RequestInit
): Promise<T> {
    const supabase = createClient();
    const token = (await supabase.auth.getSession()).data.session?.access_token;

    if (!token) {
        throw new AuthFetchError("Missing access token", 401);
    }

    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(`${API_URL}${path}`, {
        ...init,
        headers,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new AuthFetchError(
            (errorData as { detail?: string } | null)?.detail || `Request failed: ${response.status}`,
            response.status,
            errorData
        );
    }

    if (response.status === 204) {
        return undefined as T;
    }

    const json = await response.json();
    return normalizeResponse<T>(json);
}
