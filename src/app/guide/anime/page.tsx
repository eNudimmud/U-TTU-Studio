import type { Metadata } from "next";
import { GuideAnime } from "@/components/guide/guide-anime";

export const metadata: Metadata = {
  title: "ANIME Studio prompting guide · Guide · U*TTU Studio",
  description: "Real anime production terms, style vocabulary, and good-vs-bad prompts for every ANIME Studio tool.",
};

export default function Page() {
  return <GuideAnime />;
}
