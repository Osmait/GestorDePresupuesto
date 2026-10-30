-- monthly_plan_items (migration 000044) was created after RLS was enabled on
-- the user-owned tables (000037) and never got its policy. Same isolation as
-- every other user-owned table.
ALTER TABLE monthly_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_plan_items FORCE ROW LEVEL SECURITY;
CREATE POLICY monthly_plan_items_isolation ON monthly_plan_items
    USING (user_id = (SELECT current_setting('app.current_user_id', true))
        OR (SELECT current_setting('app.is_admin', true)) = 'true');
