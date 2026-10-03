-- Pack size of one piece ("300g", "350ml") for lines counted in pieces, so packs compare per 100 g / 100 ml.
-- NULL: read the size from the product or item name. 0: the user said there is no size.
ALTER TABLE expense_items ADD COLUMN size INTEGER;
ALTER TABLE expense_items ADD COLUMN size_unit TEXT;

-- Product names must not contain the pack size any more. Ask the AI again for cached names that do.
UPDATE item_gloss SET product = NULL
WHERE product GLOB '*[0-9]g*' OR product GLOB '*[0-9] g*' OR product GLOB '*[0-9]kg*'
   OR product GLOB '*[0-9]ml*' OR product GLOB '*[0-9]mL*' OR product GLOB '*[0-9]L*' OR product GLOB '*[0-9]P*';
