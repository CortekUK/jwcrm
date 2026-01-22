// Auth pages are public - no ProtectedRoute wrapper
export default function LeadManagementAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
