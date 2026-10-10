-- Keyset pagination for GET /notifications/history (newest first):
--   WHERE user_id = $1 AND (created_at, id) < ($2, $3)
--   ORDER BY created_at DESC, id DESC LIMIT $4
-- The composite index serves that order without a sort and also covers every
-- other user_id lookup (mark all read, delete all), so the single-column
-- index it supersedes is dropped to keep inserts cheap.
CREATE INDEX IF NOT EXISTS idx_notifications_user_created_id
    ON notifications (user_id, created_at DESC, id DESC);

DROP INDEX IF EXISTS idx_notifications_user_id;
