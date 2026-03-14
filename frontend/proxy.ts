// proxy.ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "./lib/supabase/server";

export async function proxy(request: NextRequest) {
    let response = NextResponse.next({
        request,
    });

    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set(
            "redirect",
            `${request.nextUrl.pathname}${request.nextUrl.search}`
        );

        return NextResponse.redirect(loginUrl);
    }

    return response;
}

export const config = {
    matcher: ["/dashboard/:path*"],
};