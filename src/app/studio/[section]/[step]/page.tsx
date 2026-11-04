import { notFound } from "next/navigation";
import { isSection, isStep } from "@/lib/sections/registry";
import { ProductionStudio } from "@/components/sections/production-studio";
export default async function Page({ params }: { params: Promise<{ section: string; step: string }> }) {
  const { section, step } = await params;
  if (isSection(section) && step === "prompts") return <ProductionStudio section={section} step="cast" library />;
  if (isSection(section) && step === "bible") return <ProductionStudio section={section} step="cast" initialPanel="bible" />;
  if (!isSection(section) || !isStep(step)) notFound();
  return <ProductionStudio section={section} step={step} />;
}
