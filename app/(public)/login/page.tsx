import Link from "next/link";
import { LoginForm } from "@/components/login-form";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectValue = params.redirect;
  const redirectPath =
    typeof redirectValue === "string" && redirectValue.startsWith("/")
      ? redirectValue
      : "/dashboard";

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
      <p className="mt-1 text-sm text-slate-500">Use your invited account credentials.</p>
      <div className="mt-6">
        <LoginForm redirectPath={redirectPath} />
      </div>
      <p className="mt-4 text-xs text-slate-500">
        New company admin?{" "}
        <Link className="font-semibold text-primary" href="/signup">
          Create account
        </Link>
      </p>
    </section>
  );
}
