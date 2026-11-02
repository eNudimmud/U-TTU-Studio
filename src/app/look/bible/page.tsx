import type { Metadata } from "next";
import { BiblePage } from "@/components/look/bible-page";

export const metadata: Metadata = {
  title: "Anime bible · U*TTU Studio",
  description: "Locks for the Anime 2.5D look. Changing one shows the estimate before anything is remade.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <BiblePage />;
}
