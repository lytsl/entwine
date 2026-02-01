import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { ArkErrors, type } from "arktype";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
	const viteEnvSchema = type({
		VITE_PORT: "string.numeric.parse",
	});

	const viteEnv = viteEnvSchema(loadEnv(mode, process.cwd()));
	if (viteEnv instanceof ArkErrors) {
		console.error(viteEnv[0].message);
		throw viteEnv[0].throw();
	}

	return {
		plugins: [tailwindcss(), tanstackRouter({}), react()],
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src"),
			},
		},
		server: {
			port: viteEnv.VITE_PORT,
		},
	};
});
