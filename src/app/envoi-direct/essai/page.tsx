import type { Metadata } from "next";
import { EssaiEnvoi } from "./essai";

export const metadata: Metadata = { title: "Essai de l’envoi direct", robots: { index: false, follow: false } };

export default function Page() {
  return <EssaiEnvoi />;
}
