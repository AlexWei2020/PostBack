// M3 线性进度指示器（不确定型），固定在视窗顶部。
export default function LinearProgress({ label = "加载中" }: { label?: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-secondary-container"
    >
      <div className="h-full w-full origin-left animate-[md-linear-indeterminate_1.6s_cubic-bezier(0.2,0,0,1)_infinite] bg-primary" />
    </div>
  );
}
