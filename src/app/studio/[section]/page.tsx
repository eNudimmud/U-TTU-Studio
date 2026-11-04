import { notFound, redirect } from "next/navigation";
import { isSection, sectionPath } from "@/lib/sections/registry";
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!isSection(section)) notFound();
  redirect(sectionPath(section, "cast"));
}
