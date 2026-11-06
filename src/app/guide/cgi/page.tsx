import { permanentRedirect } from "next/navigation";
import { withSearchParams, type LegacySearch } from "@/lib/sections/redirect";

export default async function Page({ searchParams }: { searchParams: Promise<LegacySearch> }) {
  permanentRedirect(withSearchParams("/guide/cinema", await searchParams));
}
