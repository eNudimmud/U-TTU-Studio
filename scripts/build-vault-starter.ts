import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { STARTER_VAULT_PUBLIC, starterVaultArchive } from "../src/lib/vault.ts";

mkdirSync(dirname(STARTER_VAULT_PUBLIC), { recursive: true });
writeFileSync(STARTER_VAULT_PUBLIC, starterVaultArchive());
console.log(STARTER_VAULT_PUBLIC);
