-- Wall records accept animated GIFs and short videos next to photos. GIFs are stored as animated WebP,
-- videos as uploaded MP4/WebM with a poster thumbnail captured in the browser and re-encoded on the server.
alter table "wallPhoto" add column kind text not null default 'image' check (kind in ('image', 'gif', 'video'));
alter table "wallPhoto" add column mime text not null default 'image/webp' check (mime in ('image/webp', 'video/mp4', 'video/webm'));
alter table "wallPhoto" drop constraint "wallPhoto_data_check";
alter table "wallPhoto" drop constraint "wallPhoto_thumbnail_check";
alter table "wallPhoto" add constraint "wallPhoto_media_size_check" check (
  octet_length(data) >= 1 and octet_length(thumbnail) >= 1 and case kind
    when 'image' then octet_length(data) <= 2097152 and octet_length(thumbnail) <= 262144
    when 'gif' then octet_length(data) <= 8388608 and octet_length(thumbnail) <= 2097152
    else octet_length(data) <= 20971520 and octet_length(thumbnail) <= 262144 end
);
alter table "wallPhoto" add constraint "wallPhoto_kind_mime_check" check ((kind = 'video') = (mime like 'video/%'));
-- One video per record keeps a single upload within the request body limit.
create unique index "wallPhoto_one_video_idx" on "wallPhoto" ("commentId") where kind = 'video';
-- Videos are streamed by byte ranges; uncompressed TOAST lets substring() read only the requested slice.
alter table "wallPhoto" alter column data set storage external;
