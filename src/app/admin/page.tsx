import { requireMember } from "@/lib/server/auth";

// Placeholder; the dashboard is built in Phase 9.
export default async function AdminPage() {
  await requireMember();

  return (
    <h1 className="text-[25px] font-[750] tracking-[-0.7px] font-stretch-[108%] min-[900px]:text-[30px]">
      Dashboard
    </h1>
  );
}
