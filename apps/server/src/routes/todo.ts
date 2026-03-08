import { arktypeValidator } from "@hono/arktype-validator";
import { type } from "arktype";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "@/db";
import { todo, todoSchema } from "@/db/schema";

const app = new Hono()
	.get("/", async (c) => c.json(await db.select().from(todo)))
	.post("/", arktypeValidator("json", todoSchema.create), async (c) => {
		const payload = c.req.valid("json");
		const data = await db.insert(todo).values(payload);
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
				.update(todo)
				.set(payload)
				.where(eq(todo.id, param.id));
			return c.json(data);
		},
	)
	.delete(
		"/:id",
		arktypeValidator("param", type({ id: "string.numeric.parse | number" })),
		async (c) => {
			const param = c.req.valid("param");
			const data = await db.delete(todo).where(eq(todo.id, param.id));
			return c.json(data);
		},
	);

export default app;
