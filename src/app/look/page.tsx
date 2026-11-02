import type { Metadata } from "next";
import { LookPage } from "@/components/look/look-page";

export const metadata: Metadata = {
  title: "Look · Anime 2.5D · U*TTU Studio",
  description: "Set the Anime 2.5D look for this project. Choosing it sends nothing. Every later step shows an estimated quote first.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <LookPage />;
}
