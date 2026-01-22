// Auth pages are public - no ProtectedRoute wrapper
export default function FinanceAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
