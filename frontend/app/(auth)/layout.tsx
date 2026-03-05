// Force dynamic rendering for auth pages that depend on Supabase env vars
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
