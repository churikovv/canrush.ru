import type { PoolClient } from 'pg';
import type { PreparedWallMedia } from '@/lib/wall-media';
import type { WallMediaKind } from '@/lib/wall-media-limits';

/** Discussions whose comments carry attachments, and the "commentMedia" column that points at each (migration 0077). */
export type CommentMediaTarget = 'review' | 'tierlist' | 'wall';
const COLUMN: Record<CommentMediaTarget, string> = { review: 'reviewCommentId', tierlist: 'tierListCommentId', wall: 'wallReplyId' };

export interface CommentMedia { id: string; kind: WallMediaKind }

/** Select-list item listing a comment's attachments in order, for a comment table aliased `c`. */
export function commentMediaColumn(target: CommentMediaTarget): string {
  return `coalesce((select json_agg(json_build_object('id', m.id::text, 'kind', m.kind) order by m.position) from "commentMedia" m where m."${COLUMN[target]}" = c.id), '[]'::json) as media`;
}

/** Stores attachments prepared by prepareWallMedia inside the transaction that inserted the comment. */
export async function saveCommentMedia(client: PoolClient, target: CommentMediaTarget, commentId: string, media: readonly PreparedWallMedia[]) {
  for (const [position, item] of media.entries()) {
    await client.query(`insert into "commentMedia" ("${COLUMN[target]}", position, kind, mime, data, thumbnail) values ($1, $2, $3, $4, $5, $6)`,
      [commentId, position, item.kind, item.mime, item.data, item.thumbnail]);
  }
}
