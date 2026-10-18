import type { Metadata } from "next";
import { routeMetadata } from "@/lib/route-meta";
import { AccountPage } from "@/components/account/account-page";
import { ClerkScope } from "@/components/account/clerk-scope";

export const metadata: Metadata = routeMetadata("compte", { robots: { index: false } });

export default function ComptePage() {
  return <ClerkScope><AccountPage /></ClerkScope>;
}
