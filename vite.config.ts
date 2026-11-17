// Lovable preview build: @lovable.dev/vite-tanstack-config already includes tanstackStart,
// viteReact, tailwindcss, tsConfigPaths, nitro (build-only), VITE_* env injection, the @ alias
// and React/TanStack dedupe — do NOT add them again. The vendor-neutral setup for self-hosting
// (NITRO_PRESET node-server / vercel) lives in vite.selfhost.config.ts.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import mdx from "@mdx-js/rollup";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

const docsCatalogPlugin: Plugin = {
  name: "rout-docs-catalog",
  configureServer(server) {
    const refresh = (file: string) => {
      if (!file.includes("/src/content/") || !file.endsWith(".mdx")) return;
      const catalog = server.moduleGraph.getModuleById("\0virtual:rout-docs");
      if (catalog) server.moduleGraph.invalidateModule(catalog);
      server.ws.send({ type: "full-reload" });
    };
    server.watcher.on("add", refresh);
    server.watcher.on("unlink", refresh);
  },
  handleHotUpdate({ file, server }) {
    if (!file.includes("/src/content/") || !file.endsWith(".mdx")) return;
    const catalog = server.moduleGraph.getModuleById("\0virtual:rout-docs");
    if (catalog) server.moduleGraph.invalidateModule(catalog);
    server.ws.send({ type: "full-reload" });
  },
  resolveId(id: string) { if (id === "virtual:rout-docs") return "\0virtual:rout-docs"; },
  load(id: string) {
    if (id !== "\0virtual:rout-docs") return;
    const sources: Record<string, string> = {};
    const visit = (dir: string, relative = "") => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const name = `${relative}${entry.name}`;
        if (entry.isDirectory()) visit(resolve(dir, entry.name), `${name}/`);
        else if (name.endsWith(".mdx")) sources[`/src/content/${name}`] = readFileSync(resolve(dir, entry.name), "utf8");
      }
    };
    visit(resolve("src/content"));
    return `export default ${JSON.stringify(sources)}`;
  },
};

export default defineConfig({
  tanstackStart: {
    importProtection: { behavior: "error", client: { files: ["**/server/**"], specifiers: ["server-only"] } },
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
  plugins: [
    docsCatalogPlugin,
    mdx({ include: /\.mdx$/, providerImportSource: "@mdx-js/react", remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter, remarkGfm] }),
  ],
});
