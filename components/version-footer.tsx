import packageJson from "@/package.json";

// 窄屏时为底部导航栏（80dp）留出空间
export default function VersionFooter() {
  return (
    <footer className="mb-20 py-4 text-center text-label-small text-on-surface-variant sm:mb-0 sm:pl-20">
      v{packageJson.version}
    </footer>
  );
}
