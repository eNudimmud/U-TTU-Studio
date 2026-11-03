import type { Metadata } from "next";
import { BiblePage } from "@/components/look/bible-page";

export const metadata: Metadata = {
  title: "Anime bible · ANIME Studio · U*TTU Studio",
  description: "Production rules for the Anime 2.5D look. Changing one shows the estimate before anything is remade.",
};

export default function Page() {
  return <BiblePage />;
}
