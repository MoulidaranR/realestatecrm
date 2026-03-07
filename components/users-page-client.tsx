"use client";

import { useRouter } from "next/navigation";
import { InviteUserForm } from "@/components/invite-user-form";
import { UsersTable } from "@/components/users-table";
import type { UserProfile } from "@/lib/db-types";

type UsersPageClientProps = {
  users: UserProfile[];
  managers: Array<Pick<UserProfile, "id" | "full_name" | "role_key">>;
};

export function UsersPageClient({ users, managers }: UsersPageClientProps) {
  const router = useRouter();

  return (
    <div className="space-y-5">
      <InviteUserForm onCreated={() => router.refresh()} />
      <UsersTable initialUsers={users} managerOptions={managers} />
    </div>
  );
}
