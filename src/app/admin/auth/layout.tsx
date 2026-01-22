// Auth pages are public - no ProtectedRoute wrapper
export default function AdminAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
