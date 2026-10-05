# Product URLs

product-slugs.json is an append-only registry of permanent URLs, keyed by the
existing [brand, flavor] product identity. It contains no offers or regional data.
Do not regenerate or rename existing entries when refreshing the catalog.

New identities work without deployment: productSlug uses readable brand/flavor
text with a deterministic 64-bit suffix. The product route resolves these against
the complete catalog, including the archive. If adding such identities to this
registry later, preserve their already published productSlug value.

Historical base64 URLs receive a 301 in proxy.ts, preserving the query string.
Internal links, sitemap and canonical metadata all use catalogGroupSlug.
Reviews, favorites and tier-list placements remain keyed by brand/flavor in SQL;
no database migration is needed for URL changes.
