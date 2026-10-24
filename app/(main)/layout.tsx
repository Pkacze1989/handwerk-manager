import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/auth";
import { labelOf, ROLES } from "@/lib/labels";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <Shell user={{ name: user.name, email: user.email, role: labelOf(ROLES, user.role) }}>
      {children}
    </Shell>
  );
}
