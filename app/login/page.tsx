import Link from "next/link";
import { getTotalReceived } from "@/lib/schema";
import LoginButton from "@/components/login-button";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const totalReceived = await getTotalReceived();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <Link
        href="/about"
        className="fixed right-4 top-4 rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      >
        关于
      </Link>
      <div className="text-center">
        <div className="mb-4 text-5xl">✉️</div>
        <h1 className="text-3xl font-bold tracking-tight">PostBack</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          ShanghaiTech民间明信片认领互助站
        </p>
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
          📮 已累计签收 <span className="tabular-nums">{totalReceived}</span> 张明信片
        </p>
      </div>
      <LoginButton />
    </main>
  );
}
