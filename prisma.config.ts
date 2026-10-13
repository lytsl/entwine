import { definePrismaConfig } from "@prisma/cli-engine";
import { defineConfig as ormConfig } from "@prisma/orm-sqlite/config";

// The tenant contract. Tenant files are created by the backend at run time, so `db` names a scratch file used
// only when running the CLI by hand.
export default definePrismaConfig({
  orm: ormConfig({
    contract: "./apps/backend/src/database/contract.prisma",
    output: "./apps/backend/src/database",
    db: { connection: "./data/scratch.db" },
  }),
});
