# Database migrations

## `materialTextIndex` (FR-011 / #60)

PR #59 created this text index on `studymaterials`:

- name: `title_text_description_text`
- fields: `title`, `description`

PR #60 adds `tags`, so the intended index is:

- name: `title_text_description_text_tags_text`
- fields: `title`, `description`, `tags`

MongoDB allows only one text index per collection. Calling `createIndexes()`
with the new definition while the old index exists fails with code 85,
`IndexOptionsConflict`; it does not replace the old index. Run the migration
before starting the updated API process against an existing database:

```sh
# MONGODB_URI and other required environment values must be set.
npm run migrate:material-text-index --workspace server
```

To target another environment, provide that environment's `MONGODB_URI`; the
script prints only the result, never the URI or credentials.

### Behaviour

- Fresh database: creates the new text index (status `created`).
- Database with the #59 index: drops only that known text index, then creates
  the new one (status `migrated`).
- Already migrated: no-op (status `already-migrated`), so rerunning is safe.
- Any other text index: fails with a clear error for manual reconciliation
  rather than dropping an index this migration does not own.
- If creating the replacement fails, the old index is recreated on a
  best-effort basis before the error is rethrown.

It never drops the collection and does not perform a broad index sync.

### Operational notes

Creating a text index scans the collection and rebuilds the search index, which
can take time on a large `studymaterials` collection. Dropping the old index
means text search is unavailable until the replacement finishes. Run the
migration in a low-traffic/maintenance window, back up the database according
to normal practice, and run it before deploying the API build that expects tags
to be searchable. Document data is not modified.

The automated tests use a temporary real MongoDB: they create the #59 index,
insert material records, run this migration, verify the records survive and the
new index contains `tags`, then rerun the migration to prove idempotence. Fresh
database creation is covered separately.
