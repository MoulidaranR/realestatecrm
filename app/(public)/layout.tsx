export default function PublicLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto w-full max-w-5xl px-4 py-10">{children}</div>
    </div>
  );
}
