import { readFile } from "fs/promises";
import path from "path";
import Nav from "@/components/nav";
import { renderMarkdown } from "@/lib/markdown";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const filePath = path.join(process.cwd(), "content", "about.md");
  const markdown = await readFile(filePath, "utf8");

  return (
    <>
      <Nav />
      <main className="app-main">
        <div className="container max-w-3xl">
        <article className="space-y-5">{renderMarkdown(markdown)}</article>
        </div>
      </main>
    </>
  );
}
