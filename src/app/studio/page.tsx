import { routeMetadata } from "@/lib/route-meta";
export const metadata = routeMetadata("studio");
import { LegacyStudioRedirect } from "@/components/sections/legacy-redirect";
export default function Page() { return <LegacyStudioRedirect />; }
