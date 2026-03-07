import { SignupForm } from "@/components/signup-form";

export default function SignupPage() {
  return (
    <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">Company Admin Signup</h1>
      <p className="mt-1 text-sm text-slate-500">
        Create your company workspace and admin account.
      </p>
      <div className="mt-6">
        <SignupForm />
      </div>
    </section>
  );
}
