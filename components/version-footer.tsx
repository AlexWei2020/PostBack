import packageJson from "@/package.json";

export default function VersionFooter() {
  return (
    <footer className="pointer-events-none fixed bottom-2 left-1/2 z-20 -translate-x-1/2 rounded bg-background/85 px-2 py-0.5 text-[11px] text-muted-foreground shadow-sm ring-1 ring-border/70">
      v{packageJson.version}
    </footer>
  );
}
