export interface Attachment {
  id: string;
  task_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  local_path: string;
  is_link?: number;
  thumbnail_path?: string | null;
  created_at: string;
}

export interface CreateAttachmentPayload {
  task_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  local_path: string;
  is_link?: number;
  thumbnail_path?: string | null;
}
