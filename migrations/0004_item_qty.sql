-- Count of a multi-pack line ("2個 × 単158"). price stays the line price; the unit price is price / qty.
ALTER TABLE expense_items ADD COLUMN qty INTEGER NOT NULL DEFAULT 1;
