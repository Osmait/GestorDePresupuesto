-- PostgreSQL does not support removing enum values directly.
-- To reverse this migration, the enum type would need to be recreated.
-- This is a safe no-op down migration.
SELECT 1;
