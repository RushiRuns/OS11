export interface CommentReaction {
  comment_id: string;
  reactor_device_id: string;
  emoji: string;
}

export interface Comment {
  id: string;
  task_id: string;
  author_device_id: string;
  author_name: string;
  body: string;
  parent_comment_id?: string | null;
  is_resolved: number;
  created_at: string;
  updated_at: string;
  reactions?: CommentReaction[];
}

export interface CreateCommentPayload {
  task_id: string;
  author_name: string;
  body: string;
  author_device_id?: string;
  parent_comment_id?: string | null;
}
