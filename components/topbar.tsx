import { LogoutButton } from "@/components/logout-button";

type TopbarProps = {
  fullName: string;
  roleKey: string;
};

export function Topbar({ fullName, roleKey }: TopbarProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-6 backdrop-blur">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{roleKey}</p>
        <h2 className="text-lg font-bold text-slate-900">{fullName}</h2>
      </div>
      <LogoutButton />
    </header>
  );
}
