-- 'pc' (qty is a count), 'g' or 'ml' (qty is grams or ml of a line sold by weight or volume).
ALTER TABLE expense_items ADD COLUMN unit TEXT NOT NULL DEFAULT 'pc';
