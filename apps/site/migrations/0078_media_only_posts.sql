-- Comments and wall/feed records may be just a photo, GIF or video: text becomes optional when attachments are present.
alter table "reviewComment" drop constraint "reviewComment_text_check";
alter table "reviewComment" add constraint "reviewComment_text_check" check (char_length(btrim(text)) <= 1000);
alter table "tierListComment" drop constraint "tierListComment_text_check";
alter table "tierListComment" add constraint "tierListComment_text_check" check (char_length(btrim(text)) <= 1000);
alter table "wallReply" drop constraint "wallReply_text_check";
alter table "wallReply" add constraint "wallReply_text_check" check (char_length(btrim(text)) <= 1000);
alter table "profileComment" drop constraint "profileComment_text_check";
alter table "profileComment" add constraint "profileComment_text_check" check (char_length(btrim(text)) <= 1000);

-- Attachments are inserted after their comment in the same transaction, so "text or media" is checked at commit.
create function require_text_or_media() returns trigger language plpgsql as $$
declare has_media boolean;
begin
  if btrim(new.text) <> '' then return null; end if;
  -- The row may already be gone (deleted later in the same transaction).
  if TG_TABLE_NAME = 'profileComment' then
    if not exists(select 1 from "profileComment" where id = new.id) then return null; end if;
    select exists(select 1 from "wallPhoto" where "commentId" = new.id) into has_media;
  else
    execute format('select exists(select 1 from %I where id = $1)', TG_TABLE_NAME) using new.id into has_media;
    if not has_media then return null; end if;
    select exists(select 1 from "commentMedia" m where case TG_TABLE_NAME
      when 'reviewComment' then m."reviewCommentId" when 'tierListComment' then m."tierListCommentId" else m."wallReplyId" end = new.id) into has_media;
  end if;
  if not has_media then raise exception 'A comment needs text or an attachment' using errcode = '23514'; end if;
  return null;
end $$;
create constraint trigger review_comment_text_or_media after insert or update of text on "reviewComment"
  deferrable initially deferred for each row execute function require_text_or_media();
create constraint trigger tier_comment_text_or_media after insert or update of text on "tierListComment"
  deferrable initially deferred for each row execute function require_text_or_media();
create constraint trigger wall_reply_text_or_media after insert or update of text on "wallReply"
  deferrable initially deferred for each row execute function require_text_or_media();
create constraint trigger wall_post_text_or_media after insert or update of text on "profileComment"
  deferrable initially deferred for each row execute function require_text_or_media();
