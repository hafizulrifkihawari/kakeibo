# Features

What Kakeibo can do now. Update this file when a change adds, removes, or changes a feature.

| Area | Feature | What it does |
|---|---|---|
| Add | Scan a receipt | Take a photo of a receipt. The app reads the store, date, items, and total. |
| Add | Upload a photo | Read a receipt from a photo that is already on the phone. |
| Add | Paste text | Read text that you copied, for example from Google Lens. |
| Add | Order email | Open or share an `.eml` file, or paste email text. The app reads the order and checks the total. |
| Add | Manual entry | Type an expense yourself. |
| Add | Scan collection | Opt-in for each user, off by default. After you save a scanned receipt, the app keeps the photo and its first reading until your computer downloads them. Use them to test and train a local receipt model (kakeibo-lab). |
| Add | Offline reading | Receipts are read on the phone when Google Vision is over its limit, fails, or there is no network. |
| Expense form | Items | Edit each line. Each item shows its furigana reading and an English translation. |
| Expense form | Products | Link an item to a product, with quantity, unit (pieces, g, ml), pack size, and kind. |
| Expense form | Price check | Compare each price with your earlier purchases of the same product. |
| Expense form | Other costs | Add tax, shipping, fees, and discounts. These are not products. |
| Expense form | Tax help | Read added tax (外税) from the receipt. Offer "Add as tax" when the total is a little more than the items. |
| Expense form | Thousand separators | Show a "." between thousands in every money field, such as 1.250.000. This also applies to income and budget fields. |
| Expense form | Category | Suggest a category from your rules, store chains, and item words. Learn a rule when you change it. |
| Expense form | Edit and delete | Change or remove an expense that you saved. |
| Spending | Home | Show today's total, this month's total, the daily average, the last 7 days, and recent expenses. |
| Spending | Calendar | Show a month grid and totals by category. Tap a category to filter. Swipe to change the month. |
| Spending | Day | Show the expenses of one date. |
| Income | Add income | Record money in, with amount, date, source (salary, part-time, bonus, gift, refund, other), and note. |
| Income | Edit and delete | Tap an income row to change or remove it. |
| Income | Balance | Show income, spending, and the amount left, for each month and on Home. |
| Budget | Monthly budget | Set a limit for all spending and for each category. The limits apply to every month. |
| Budget | Progress | Show what you spent, what is left, the month-end projection, and how much you can spend each day. Home shows the monthly budget. |
| Budget | Pace warning | Warn when the current pace goes over a limit by the month end. Show the amount over when you pass a limit. |
| Prices | Product list | Show your products and their prices. |
| Prices | Price history | Show earlier prices and the cheapest store for a product. Compare by one piece or by 100 g / 100 ml. |
| Prices | Product kind | Set the kind of a product. |
| Account | Register and log in | Use an email address and a password. |
| Account | Change password | Set a new password. Other devices are logged out. |
| Account | Telegram reset | Link Telegram, then use "Forgot password?" to get a one-time reset link. |
| Settings | Vision usage | Show how many Google Vision scans you used this month. |
| Settings | Offline reader | Download the on-device receipt reader (about 35 MB). |
| Offline | Install | Add the app to the home screen (PWA). |
| Offline | Sync queue | Changes made offline wait and sync when the network comes back. A banner shows them. |
| Admin | Password reset script | `npm run admin -- reset <email>` sets a temporary password for a user. |
| Admin | Scan collection script | `npm run admin -- collect <email> on\|off` turns scan collection on or off for a user. |
