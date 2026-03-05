// lib/form-context.ts  (or wherever you keep shared form utilities)
//
// TanStack Form v1 does not have a generic useFormContext().
// Instead, you define your form shape once with formOptions(), then call
// createFormHook() to get a fully-typed useAppForm() + FormProvider pair.
//
// Both StoreEditForm and BusinessHoursForm import from here.

import { createFormHook, createFormHookContexts } from "@tanstack/react-form";
import type { ReactNode } from "react";

export const { fieldContext, formContext, useFieldContext, useFormContext } =
    createFormHookContexts();

// If you want a custom useAppForm with your own field/form components you can
// expand this later. For now we just re-export the raw hook so child components
// can read the parent form context.
export const { useAppForm } = createFormHook({
    fieldComponents: {},
    formComponents: {},
    fieldContext,
    formContext,
});

type TypedFieldContext<TValues extends Record<string, unknown>> = {
    Field: <TName extends Extract<keyof TValues, string>>(props: {
        name: TName;
        children: (field: {
            state: { value: TValues[TName] };
            handleChange: (value: TValues[TName]) => void;
        }) => ReactNode;
    }) => ReactNode;
};

export function useTypedFormContext<TValues extends Record<string, unknown>>() {
    return useFormContext() as unknown as TypedFieldContext<TValues>;
}