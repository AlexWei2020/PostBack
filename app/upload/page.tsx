import Nav from "@/components/nav";
import UploadClient from "./upload-client";

export default function UploadPage() {
  return (
    <>
      <Nav />
      <main className="app-main">
        <div className="container max-w-xl">
        <div className="mb-6 pt-2">
          <h1 className="text-headline-medium text-on-surface">上传明信片</h1>
          <p className="mt-2 text-body-medium text-on-surface-variant">
            拍下明信片风景面，注意保护收件人隐私，不要拍信息面~
          </p>
        </div>
        <UploadClient />
        </div>
      </main>
    </>
  );
}
