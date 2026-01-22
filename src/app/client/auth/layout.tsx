// Auth pages are public - no ProtectedRoute wrapper
export default function ClientAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
