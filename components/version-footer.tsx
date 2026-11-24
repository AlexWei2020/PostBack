import packageJson from "@/package.json";

// 窄屏时为底部导航栏（80dp）留出空间
export default function VersionFooter() {
  return (
    <footer className="mb-[calc(5rem+env(safe-area-inset-bottom))] py-4 text-center text-label-small text-on-surface-variant medium:mb-0 medium:pl-20">
      v{packageJson.version}
    </footer>
  );
}
