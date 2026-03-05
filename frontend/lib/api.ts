const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type RequestOptions = {
    method?: string;
    body?: unknown;
    token?: string;
    headers?: Record<string, string>;
};

class ApiError extends Error {
    status: number;
    data: unknown;

    constructor(message: string, status: number, data?: unknown) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.data = data;
    }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, token, headers: extraHeaders } = options;

    const headers: Record<string, string> = {
        ...extraHeaders,
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    if (body && !(body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new ApiError(
            errorData?.detail || `API error: ${res.status}`,
            res.status,
            errorData
        );
    }

    if (res.status === 204) return undefined as T;
    return res.json();
}

// --- Stores ---

export const api = {
    stores: {
        create: (data: unknown, token: string) =>
            request("/stores", { method: "POST", body: data, token }),
        getBySlug: (slug: string) =>
            request(`/stores/${slug}`),
        update: (storeId: string, data: unknown, token: string) =>
            request(`/stores/${storeId}`, { method: "PATCH", body: data, token }),
        listMine: (token: string) =>
            request(`/stores/mine/members`, { token }),
    },

    categories: {
        list: (storeId: string) =>
            request(`/stores/${storeId}/categories`),
        create: (storeId: string, data: unknown, token: string) =>
            request(`/stores/${storeId}/categories`, { method: "POST", body: data, token }),
        update: (storeId: string, categoryId: string, data: unknown, token: string) =>
            request(`/stores/${storeId}/categories/${categoryId}`, { method: "PATCH", body: data, token }),
        delete: (storeId: string, categoryId: string, token: string) =>
            request(`/stores/${storeId}/categories/${categoryId}`, { method: "DELETE", token }),
    },

    products: {
        list: (storeId: string, categoryId?: string) =>
            request(`/stores/${storeId}/products${categoryId ? `?category_id=${categoryId}` : ""}`),
        get: (storeId: string, productId: string) =>
            request(`/stores/${storeId}/products/${productId}`),
        create: (storeId: string, data: unknown, token: string) =>
            request(`/stores/${storeId}/products`, { method: "POST", body: data, token }),
        update: (storeId: string, productId: string, data: unknown, token: string) =>
            request(`/stores/${storeId}/products/${productId}`, { method: "PATCH", body: data, token }),
        delete: (storeId: string, productId: string, token: string) =>
            request(`/stores/${storeId}/products/${productId}`, { method: "DELETE", token }),
    },

    orders: {
        create: (storeId: string, data: unknown) =>
            request(`/stores/${storeId}/orders`, { method: "POST", body: data }),
        list: (storeId: string, token: string, statusFilter?: string) =>
            request(`/stores/${storeId}/orders${statusFilter ? `?status_filter=${statusFilter}` : ""}`, { token }),
        get: (storeId: string, orderId: string) =>
            request(`/stores/${storeId}/orders/${orderId}`),
        updateStatus: (storeId: string, orderId: string, status: string, token: string) =>
            request(`/stores/${storeId}/orders/${orderId}/status`, { method: "PATCH", body: { status }, token }),
    },

    menuImports: {
        upload: (storeId: string, file: File, token: string) => {
            const formData = new FormData();
            formData.append("file", file);
            return request(`/stores/${storeId}/menu-imports/upload`, { method: "POST", body: formData, token });
        },
        process: (storeId: string, importId: string, token: string) =>
            request(`/stores/${storeId}/menu-imports/${importId}/process`, { method: "POST", token }),
        get: (storeId: string, importId: string, token: string) =>
            request(`/stores/${storeId}/menu-imports/${importId}`, { token }),
        list: (storeId: string, token: string) =>
            request(`/stores/${storeId}/menu-imports`, { token }),
        updateItem: (storeId: string, importId: string, itemId: string, data: unknown, token: string) =>
            request(`/stores/${storeId}/menu-imports/${importId}/items/${itemId}`, { method: "PATCH", body: data, token }),
        publish: (storeId: string, importId: string, token: string) =>
            request(`/stores/${storeId}/menu-imports/${importId}/publish`, { method: "POST", token }),
    },

    payments: {
        createIntent: (storeId: string, amount: number) =>
            request("/payments/create-intent", { method: "POST", body: { store_id: storeId, amount } }),
    },

    stripe: {
        onboard: (storeId: string, token: string) =>
            request(`/stores/${storeId}/stripe/onboard`, { method: "POST", token }),
        status: (storeId: string, token: string) =>
            request(`/stores/${storeId}/stripe/status`, { token }),
    },
};

export { ApiError };
