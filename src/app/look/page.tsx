import { redirect } from "next/navigation";

// Renamed to ANIME Studio. Old links (bookmarks, other PRs) still land, now on the clear name.
export default function Page() {
  redirect("/anime");
}
