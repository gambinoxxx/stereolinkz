import { Landing } from "@/features/public/components/Landing";
import { getPublicLanding } from "@/features/public/queries";

// Static, regenerated when a board is generated or the settings are saved
// (revalidatePath("/") in those actions), and at most an hour old
// otherwise. Saving a rate alone doesn't change this page.
export const revalidate = 3600;

export default async function Home() {
  return <Landing data={await getPublicLanding()} />;
}
