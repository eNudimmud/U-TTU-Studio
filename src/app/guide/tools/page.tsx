import type { Metadata } from "next";
import { GuideTools } from "@/components/guide/guide-tools";

export const metadata: Metadata = {
  title: "Tools · Guide · U*TTU Studio",
  description: "Plain notes on each engine: what it does best, one tip, and an estimated cost.",
};

export default function Page() {
  return <GuideTools />;
}
