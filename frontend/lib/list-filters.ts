import { useUrlQueryState } from "@/hooks/use-url-query-state";

export type ListFilterConfig<TFilters, TQueryShape = unknown> = {
    parse: (searchParams: URLSearchParams) => TFilters;
    serialize: (filters: TFilters) => URLSearchParams;
    equals: (left: TFilters, right: TFilters) => boolean;
    toApiParams: (filters: TFilters) => URLSearchParams;
    toQueryShape: (filters: TFilters) => TQueryShape;
};

export function useListFilters<TFilters, TQueryShape = unknown>(
    config: ListFilterConfig<TFilters, TQueryShape>
) {
    const { state, setState } = useUrlQueryState<TFilters>({
        parse: config.parse,
        serialize: config.serialize,
        isEqual: config.equals,
    });

    return {
        filters: state,
        updateFilters: setState,
        toApiParams: config.toApiParams,
        toQueryShape: config.toQueryShape,
    };
}

export function buildListQueryKey<TQueryShape>(
    namespace: string,
    resourceId: string,
    queryShape: TQueryShape,
) {
    return [namespace, resourceId, queryShape] as const;
}
