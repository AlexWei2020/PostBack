import Nav from "@/components/nav";
import UploadClient from "./upload-client";

export default function UploadPage() {
  return (
    <>
      <Nav />
      <main className="container max-w-xl py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">上传明信片</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            拍下明信片风景面，注意保护收件人隐私，不要拍信息面~
          </p>
        </div>
        <UploadClient />
      </main>
    </>
  );
}
