import { arktypeValidator } from "@hono/arktype-validator";
import { type } from "arktype";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db, dbSchema } from "@/db";
import { todoSchema } from "@/db/schema/todo";

const app = new Hono()
  .get("/", async (c) => c.json(await db.select().from(dbSchema.todo)))
  .post("/", arktypeValidator("json", todoSchema.create), async (c) => {
    const payload = c.req.valid("json");
    const data = await db.insert(dbSchema.todo).values(payload);
    return c.json(data, 201);
  })
  .patch(
    "/:id",
    arktypeValidator("json", todoSchema.update),
    arktypeValidator("param", type({ id: "string.numeric.parse | number" })),
    async (c) => {
      const param = c.req.valid("param");
      const payload = c.req.valid("json");
      const data = await db
        .update(dbSchema.todo)
        .set(payload)
        .where(eq(dbSchema.todo.id, param.id));
      return c.json(data);
    },
  )
  .delete(
    "/:id",
    arktypeValidator("param", type({ id: "string.numeric.parse | number" })),
    async (c) => {
      const param = c.req.valid("param");
      const data = await db
        .delete(dbSchema.todo)
        .where(eq(dbSchema.todo.id, param.id));
      return c.json(data);
    },
  );

export default app;
