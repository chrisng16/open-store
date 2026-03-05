import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Dashboard routes: require authentication
    if (pathname.startsWith("/dashboard")) {
        return handleDashboardAuth(request);
    }

    // All other routes pass through
    return NextResponse.next();
}

function handleDashboardAuth(request: NextRequest) {
    // Refresh Supabase session via cookies
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    response = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // The session refresh happens automatically when Supabase client is created
    // with cookie handling. Client-side auth guard in DashboardLayout handles
    // redirect to /login if no session.

    return response;
}
