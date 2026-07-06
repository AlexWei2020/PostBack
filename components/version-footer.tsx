import packageJson from "@/package.json";

export default function VersionFooter() {
  return (
    <footer className="fixed bottom-2 right-3 z-20 text-[10px] text-muted-foreground/70">
      v{packageJson.version}
    </footer>
  );
}
