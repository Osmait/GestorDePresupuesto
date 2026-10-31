DROP POLICY IF EXISTS monthly_plan_items_isolation ON monthly_plan_items;
ALTER TABLE monthly_plan_items NO FORCE ROW LEVEL SECURITY;
ALTER TABLE monthly_plan_items DISABLE ROW LEVEL SECURITY;
