-- The category of each receipt line (dairy, clothing, ...), as auto-detected or tagged by the user.
ALTER TABLE expense_items ADD COLUMN kind TEXT;
