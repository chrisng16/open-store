import type { SortingState } from "@tanstack/react-table";

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 50;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export type PaginationParams = {
    page: number;
    pageSize: number;
};

export type PaginatedResponse<T> = {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
};

type SearchParamsReader = {
    get(name: string): string | null;
};

export function normalizePageInput(value: string | null) {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_PAGE;
}

export function normalizePageSizeInput(value: string | null) {
    const parsed = Number.parseInt(value ?? "", 10);
    return PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number])
        ? (parsed as (typeof PAGE_SIZE_OPTIONS)[number])
        : DEFAULT_PAGE_SIZE;
}

export function parsePaginationSearchParams(searchParams: SearchParamsReader): PaginationParams {
    return {
        page: normalizePageInput(searchParams.get("page")),
        pageSize: normalizePageSizeInput(searchParams.get("pageSize")),
    };
}

export function applyPaginationSearchParams(
    params: URLSearchParams,
    pagination: PaginationParams,
) {
    if (pagination.page !== DEFAULT_PAGE) {
        params.set("page", String(pagination.page));
    } else {
        params.delete("page");
    }

    if (pagination.pageSize !== DEFAULT_PAGE_SIZE) {
        params.set("pageSize", String(pagination.pageSize));
    } else {
        params.delete("pageSize");
    }
}

export function applyPaginationApiParams(
    params: URLSearchParams,
    pagination: PaginationParams,
) {
    params.set("page", String(pagination.page));
    params.set("page_size", String(pagination.pageSize));
}

export function arePaginationParamsEqual(left: PaginationParams, right: PaginationParams) {
    return left.page === right.page && left.pageSize === right.pageSize;
}

type SortFallback = {
    id: string;
    desc: boolean;
};

export function parseSortingSearchParam(
    rawSort: string | null,
    allowedColumnIds: readonly string[],
    fallback?: SortFallback,
): SortingState {
    if (!rawSort) {
        return fallback ? [{ id: fallback.id, desc: fallback.desc }] : [];
    }

    const [columnId, direction] = rawSort.split(":");
    const normalizedColumnId = columnId?.trim();
    const normalizedDirection = direction?.trim().toLowerCase();

    if (
        normalizedColumnId &&
        allowedColumnIds.includes(normalizedColumnId) &&
        (normalizedDirection === "asc" || normalizedDirection === "desc")
    ) {
        return [{ id: normalizedColumnId, desc: normalizedDirection === "desc" }];
    }

    return fallback ? [{ id: fallback.id, desc: fallback.desc }] : [];
}

export function applySortingSearchParam(
    params: URLSearchParams,
    sorting: SortingState,
    fallback?: SortFallback,
) {
    const activeSort = sorting[0];
    const fallbackSort = fallback ? { id: fallback.id, desc: fallback.desc } : undefined;

    if (!activeSort) {
        params.delete("sort");
        return;
    }

    if (fallbackSort && activeSort.id === fallbackSort.id && activeSort.desc === fallbackSort.desc) {
        params.delete("sort");
        return;
    }

    params.set("sort", `${activeSort.id}:${activeSort.desc ? "desc" : "asc"}`);
}

export function areSortingParamsEqual(left: SortingState, right: SortingState) {
    if (left.length !== right.length) {
        return false;
    }

    return left.every((entry, index) => {
        const other = right[index];
        return entry.id === other.id && entry.desc === other.desc;
    });
}