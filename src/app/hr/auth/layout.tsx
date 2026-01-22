// Auth pages are public - no ProtectedRoute wrapper
export default function HRAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
