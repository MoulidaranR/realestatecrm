import { InviteAcceptForm } from "@/components/invite-accept-form";

export default function InviteAcceptPage() {
  return (
    <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">Complete your invite</h1>
      <p className="mt-1 text-sm text-slate-500">
        Set your profile details to activate CRM access.
      </p>
      <div className="mt-6">
        <InviteAcceptForm />
      </div>
    </section>
  );
}
