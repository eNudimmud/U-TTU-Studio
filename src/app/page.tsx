import type { Metadata } from "next";
import { HomeLanding } from "@/components/landing/home";
import { siteDescription, siteTitle } from "@/lib/site";

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
};

export default function Home() {
  return <HomeLanding />;
}
