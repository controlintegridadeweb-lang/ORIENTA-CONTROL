import { redirect } from "next/navigation";
import { getCurrentUser, homeRouteForRole } from "@/infrastructure/auth/current-user";
import { MfaForm } from "@/features/auth/components/mfa-form";
import { AuthSplitLayout } from "@/features/auth/components/auth-split-layout";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ redirect?: string }> };

export default async function MfaPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.role !== "admin") redirect(homeRouteForRole(user.role));
  const query = await searchParams;

  return (
    <AuthSplitLayout>
      <MfaForm redirectTo={query.redirect ?? "/admin"} />
    </AuthSplitLayout>
  );
}
