import type { Postcard } from "@/lib/types";

// 未登录访客只能看到照片和状态：其余字段在服务端清空，不随响应下发。
export function toGuestPostcard(p: Postcard): Postcard {
  return {
    id: p.id,
    image_url: p.image_url,
    status: p.status,
    created_at: p.created_at,
    recipient_name: "",
    pickup_location: null,
    note: null,
    uploader_id: null,
    claimer_id: null,
    sent_at: null,
    arrived_at: null,
    claimed_at: null,
    received_at: null,
  };
}
