import { expect, test } from "bun:test";
import { MODELS, type ModelName, rowSchemas } from "@entwine/shared";
import type sqlite from "@prisma/orm-sqlite/runtime";
import type { z } from "zod";
import type { Contract } from "../../src/database/contract";
import contractJson from "../../src/database/contract.json" with { type: "json" };

type Orm = ReturnType<typeof sqlite<Contract>>["orm"];
type Stored<M extends ModelName> = Orm[M] extends { first(): Promise<infer R | null> } ? R : never;

test("every row schema describes its table", () => {
  // The types: what a schema lets through fits the table's columns.
  rowSchemas satisfies { [M in ModelName]: z.ZodType<Stored<M>, unknown> };
  for (const model of MODELS) {
    const columns = Object.keys(contractJson.domain.namespaces.__unbound__.models[model].fields).sort();
    expect(Object.keys(rowSchemas[model].shape).sort()).toEqual(columns);
  }
});
