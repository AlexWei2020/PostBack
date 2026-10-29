import Link from "next/link";
import { getTotalReceived } from "@/lib/schema";
import LoginButton from "@/components/login-button";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const totalReceived = await getTotalReceived();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <Link href="/about" className="btn-text fixed right-4 top-3">
        关于
      </Link>
      <div className="card-elevated flex w-full max-w-sm flex-col items-center gap-6 px-6 py-8 text-center">
        <div className="text-5xl">✉️</div>
        <div>
          <h1 className="text-headline-medium text-on-surface">PostBack</h1>
          <p className="mt-2 text-body-medium text-on-surface-variant">
            ShanghaiTech民间明信片认领互助站
          </p>
        </div>
        <p className="inline-flex h-8 items-center gap-2 rounded-sm bg-tertiary-container px-3 text-label-large text-on-tertiary-container">
          📮 已累计签收 <span className="tabular-nums">{totalReceived}</span> 张明信片
        </p>
        <LoginButton />
      </div>
    </main>
  );
}
