export default function StoreIdLayout({
    children,

}: {
    children: React.ReactNode;

}) {
    return (
        <div className="relative h-full">
            {children}
        </div>
    );
}
