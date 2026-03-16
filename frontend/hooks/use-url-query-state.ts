"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";

type UseUrlQueryStateOptions<TState> = {
    parse: (searchParams: URLSearchParams) => TState;
    serialize: (state: TState) => URLSearchParams;
    isEqual: (left: TState, right: TState) => boolean;
};

export function useUrlQueryState<TState>({
    parse,
    serialize,
    isEqual,
}: UseUrlQueryStateOptions<TState>) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const urlState = useMemo(() => parse(searchParams), [parse, searchParams]);
    const [state, setState] = useState<TState>(urlState);

    useEffect(() => {
        setState((current) => (isEqual(current, urlState) ? current : urlState));
    }, [isEqual, urlState]);

    const replaceUrl = useCallback(
        (nextState: TState) => {
            const nextQuery = serialize(nextState).toString();
            startTransition(() => {
                router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
            });
        },
        [pathname, router, serialize]
    );

    const updateState = useCallback(
        (mutator: (current: TState) => TState) => {
            const nextState = mutator(state);
            if (isEqual(state, nextState)) {
                return;
            }

            setState(nextState);
            replaceUrl(nextState);
        },
        [isEqual, replaceUrl, state]
    );

    return {
        state,
        setState: updateState,
    };
}