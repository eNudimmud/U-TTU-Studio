import type { Metadata } from "next";
import { CgiStudio } from "@/components/cgi/cgi-studio";

export const metadata: Metadata = {
  title: "Cinema · U*TTU Studio",
  description: "The photoreal pipeline only: Cast, Set, Shoot, Edit, Finish. One open-weight model per step, picked for faithful characters and places.",
};

export default function Page() {
  return <CgiStudio />;
}
