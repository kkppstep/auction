// Admin pages (login, dashboard) keep the same constrained-width look
// they were designed with — just without the shop's bottom nav, which
// they never used anyway.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto min-h-screen max-w-md">{children}</div>;
}
