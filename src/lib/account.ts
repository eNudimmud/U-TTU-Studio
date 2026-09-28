// Account shell. Compte is not a vault room: the canon stays on disk.

import { VAULT_DOCUMENTS, VAULT_FOLDERS } from "./vault.ts";

export const ACCOUNT_SIGN_IN_PATH = "/sign-in";
export const ACCOUNT_SIGN_UP_PATH = "/sign-up";
export const ACCOUNT_HOME_HASH = "/#compte";
export const ACCOUNT_CREER_HASH = "/#creer";

/** Providers JD enables in the Clerk dashboard. SignIn shows whatever is on. */
export const CLERK_OAUTH_PROVIDERS = ["google", "github"] as const;

export const ACCOUNT_VAULT_LINKS = [
  ...VAULT_FOLDERS.map(folder => ({
    id: folder.name,
    label: `${folder.name}/`,
    hint: folder.hint,
    href: "#studio",
  })),
  ...VAULT_DOCUMENTS.map(doc => ({
    id: doc.name,
    label: doc.name,
    hint: doc.hint,
    href: "#studio",
  })),
] as const;
