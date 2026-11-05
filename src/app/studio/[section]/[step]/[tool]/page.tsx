import {notFound} from "next/navigation";
import {ProductionStudio} from "@/components/sections/production-studio";
import {isSection,isStep} from "@/lib/sections/registry";
import {sectionTools} from "@/lib/sections/tools";
export default async function Page({params}:{params:Promise<{section:string;step:string;tool:string}>}) {
 const {section,step,tool}=await params;
 if(!isSection(section)||!isStep(step)||!sectionTools(step).some(entry=>entry.tool.id===tool))notFound();
 return <ProductionStudio section={section} step={step} toolId={tool}/>;
}
