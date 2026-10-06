-- Costs on a receipt that are not a product: consumption tax, shipping, fees, discounts.
CREATE TABLE expense_charges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'other',
  name TEXT NOT NULL DEFAULT '',
  amount INTEGER NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX expense_charges_expense ON expense_charges(expense_id);

-- Order emails saved shipping and the discount as items. Move them to charges.
INSERT INTO expense_charges (expense_id, kind, name, amount, sort)
SELECT expense_id, CASE name WHEN 'Frete / 送料' THEN 'shipping' ELSE 'discount' END, name, price, sort
FROM expense_items WHERE name IN ('Frete / 送料', '値引 / Discount');
DELETE FROM expense_items WHERE name IN ('Frete / 送料', '値引 / Discount');
