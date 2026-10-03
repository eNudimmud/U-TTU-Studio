import type { Metadata } from "next";
import { AccountPage } from "@/components/account/account-page";
import { ClerkScope } from "@/components/account/clerk-scope";

export const metadata: Metadata = { title: "Compte — U*TTU Studio", robots: { index: false } };

export default function ComptePage() {
  return <ClerkScope><AccountPage /></ClerkScope>;
}
