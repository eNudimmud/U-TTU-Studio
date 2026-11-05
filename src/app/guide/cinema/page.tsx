import type { Metadata } from "next";
import { GuideCgi } from "@/components/guide/guide-cgi";

export const metadata: Metadata = {
  title: "Cinema prompting · Guide · U*TTU Studio",
  description: "The cinematography glossary and six tools' prompting notes, with a good and a bad example for each.",
};

export default function Page() {
  return <GuideCgi />;
}
