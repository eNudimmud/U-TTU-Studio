import type { Metadata } from "next";
import { LookPage } from "@/components/look/look-page";

export const metadata: Metadata = {
  title: "ANIME Studio · Anime 2.5D · U*TTU Studio",
  description: "Set the Anime 2.5D look for this project. Choosing it sends nothing. Every later step shows an estimated quote first.",
};

export default function Page() {
  return <LookPage />;
}
