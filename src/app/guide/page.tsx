import type { Metadata } from "next";
import { GuideHome } from "@/components/guide/guide-home";

export const metadata: Metadata = {
  title: "Guide · U*TTU Studio",
  description: "How the studio works, the five steps, Anime 2.5D, costs and the engines. The studio stays clear for the work.",
};

export default function Page() {
  return <GuideHome />;
}
