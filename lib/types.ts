export type PostcardStatus = "available" | "claimed" | "received";

export type Postcard = {
  id: string;
  image_url: string;
  image_hash?: string | null;
  recipient_name: string;
  pickup_location: string | null;
  note: string | null;
  status: PostcardStatus;
  uploader_id: string | null;
  claimer_id: string | null;
  sent_at: string | null;
  arrived_at: string | null;
  created_at: string;
  claimed_at: string | null;
  received_at: string | null;
  // joined fields
  uploader_nickname?: string | null;
  claimer_nickname?: string | null;
};

export type PostcardUpdateInput = {
  recipientName: string;
  pickupLocation?: string;
  note?: string;
  sentAt?: string;
  arrivedAt?: string;
};

export const STATUS_LABEL: Record<PostcardStatus, string> = {
  available: "待认领",
  claimed: "已认领",
  received: "已收到",
};
