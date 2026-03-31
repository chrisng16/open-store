import * as sdk from "./api-generated";
import { denormalizeRequest, normalizeResponse } from "./normalize-response";
import * as T from "./types";

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

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, token, headers: extraHeaders } = options;

    const headers: Record<string, string> = {
        ...extraHeaders,
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const isJson = !(body instanceof FormData);
    if (isJson) {
        headers["Content-Type"] = "application/json";
    }

    const normalizedBody = isJson ? denormalizeRequest(body) : body;

    const res = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: isJson ? JSON.stringify(normalizedBody) : (body as FormData),
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

    const json = await res.json();
    return normalizeResponse<T>(json);
}

// --- Stores ---

export const api = {
    stores: {
        create: (data: sdk.StoreCreate, token: string) =>
            apiRequest<T.Store>("/stores", { method: "POST", body: data, token }),
        getBySlug: (slug: string) =>
            apiRequest<T.StorePublic>(`/stores/slug/${slug}`),
        getById: (storeId: string) =>
            apiRequest<T.Store>(`/stores/${storeId}`),
        update: (storeId: string, data: sdk.StoreUpdate, token: string) =>
            apiRequest<T.Store>(`/stores/${storeId}`, { method: "PATCH", body: data, token }),
        onboardingStatus: (storeId: string, token: string) =>
            apiRequest<T.StoreOnboardingStatus>(`/stores/${storeId}/onboarding-status`, { token }),
        refreshOnboardingStatus: (storeId: string, token: string) =>
            apiRequest<T.StoreOnboardingStatus>(`/stores/${storeId}/onboarding-status/refresh`, { method: "POST", token }),
        listMine: (token: string) =>
            apiRequest<T.Store[]>("/stores", { token }),
    },

    categories: {
        list: (storeId: string) =>
            apiRequest<{ items: T.Category[] }>(`/stores/${storeId}/categories?page=1&page_size=500`).then((response) => response.items),
        create: (storeId: string, data: sdk.CategoryCreate, token: string) =>
            apiRequest<T.Category>(`/stores/${storeId}/categories`, { method: "POST", body: data, token }),
        update: (storeId: string, categoryId: string, data: sdk.CategoryUpdate, token: string) =>
            apiRequest<T.Category>(`/stores/${storeId}/categories/${categoryId}`, { method: "PATCH", body: data, token }),
        delete: (storeId: string, categoryId: string, token: string) =>
            apiRequest(`/stores/${storeId}/categories/${categoryId}`, { method: "DELETE", token }),
    },

    products: {
        list: (storeId: string, categoryId?: string) =>
            apiRequest<{ items: T.ProductWithCategoryListItem[] }>(`/stores/${storeId}/products?page=1&page_size=500${categoryId ? `&category_id=${categoryId}` : ""}`).then((response) => response.items),
        get: (storeId: string, productId: string) =>
            apiRequest<T.Product>(`/stores/${storeId}/products/${productId}`),
        create: (storeId: string, data: sdk.ProductCreate, token: string) =>
            apiRequest<T.Product>(`/stores/${storeId}/products`, { method: "POST", body: data, token }),
        update: (storeId: string, productId: string, data: sdk.ProductUpdate, token: string) =>
            apiRequest<T.Product>(`/stores/${storeId}/products/${productId}`, { method: "PATCH", body: data, token }),
        delete: (storeId: string, productId: string, token: string) =>
            apiRequest(`/stores/${storeId}/products/${productId}`, { method: "DELETE", token }),
    },

    orders: {
        initiateCheckout: (storeId: string, data: any) =>
            apiRequest<any>(`/stores/${storeId}/checkout/initiate`, { method: "POST", body: data }),
        create: (storeId: string, data: sdk.OrderCreate) =>
            apiRequest<T.Order>(`/stores/${storeId}/orders`, { method: "POST", body: data }),
        update: (storeId: string, orderId: string, data: any, accessToken?: string) =>
            apiRequest<T.Order>(`/stores/${storeId}/orders/${orderId}${accessToken ? `?access=${encodeURIComponent(accessToken)}` : ""}`, { method: "PATCH", body: data }),
        lookup: (storeId: string, data: sdk.OrderLookupRequest) =>
            apiRequest<T.OrderLookupResponse>(`/stores/${storeId}/orders/lookup`, { method: "POST", body: data }),
        list: (storeId: string, token: string, statusFilter?: string) =>
            apiRequest<{ items: T.Order[] }>(`/stores/${storeId}/orders?page=1&page_size=500${statusFilter ? `&status=${statusFilter}` : ""}`, { token }).then((response) => response.items),
        get: (storeId: string, orderId: string) =>
            apiRequest<T.Order>(`/stores/${storeId}/orders/${orderId}`),
        updateStatus: (storeId: string, orderId: string, status: string, token: string) =>
            apiRequest<T.Order>(`/stores/${storeId}/orders/${orderId}/status`, { method: "PATCH", body: { status }, token }),
    },

    menuImports: {
        upload: (storeId: string, file: File, token: string) => {
            const formData = new FormData();
            formData.append("file", file);
            return apiRequest<T.MenuImport>(`/stores/${storeId}/menu-imports/upload`, { method: "POST", body: formData, token });
        },
        process: (storeId: string, importId: string, token: string) =>
            apiRequest<T.MenuImport>(`/stores/${storeId}/menu-imports/${importId}/process`, { method: "POST", token }),
        get: (storeId: string, importId: string, token: string) =>
            apiRequest<T.MenuImport>(`/stores/${storeId}/menu-imports/${importId}`, { token }),
        list: (storeId: string, token: string) =>
            apiRequest<T.MenuImport[]>(`/stores/${storeId}/menu-imports`, { token }),
        updateItem: (storeId: string, importId: string, itemId: string, data: sdk.MenuImportItemUpdate, token: string) =>
            apiRequest<T.MenuImportItem>(`/stores/${storeId}/menu-imports/${importId}/items/${itemId}`, { method: "PATCH", body: data, token }),
        publish: (storeId: string, importId: string, token: string) =>
            apiRequest<T.MenuImport>(`/stores/${storeId}/menu-imports/${importId}/publish`, { method: "POST", token }),
    },

    payments: {
        // orderAccessToken is the guest token returned when the order was created.
        // It is embedded by the backend into the Stripe return_url so the
        // confirmation page can fetch the token-gated order after the redirect,
        // without requiring the customer to be logged in.
        createSession: (orderId: string, orderAccessToken?: string) =>
            apiRequest<T.CheckoutSession>("/payments/create-session", {
                method: "POST",
                body: {
                    order_id: orderId,
                    ...(orderAccessToken ? { order_access_token: orderAccessToken } : {}),
                },
            }),
    },

    stripe: {
        onboard: (storeId: string, token: string) =>
            apiRequest<{ url: string }>(`/stores/${storeId}/stripe/onboard`, { method: "POST", token }),
        status: (storeId: string, token: string) =>
            apiRequest<{ status: string }>(`/stores/${storeId}/stripe/status`, { token }),
    },
};

export { ApiError };
