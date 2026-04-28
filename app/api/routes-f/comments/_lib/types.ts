export type CommentRecord = {
  id: string;
  author: string;
  text: string;
  parent_id: string | null;
  depth: number;
  created_at: string;
  deleted: boolean;
};

export type ThreadedComment = CommentRecord & {
  children: ThreadedComment[];
};
