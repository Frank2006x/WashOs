# WashOs Seed Data Guide

This guide explains how to populate your Neon PostgreSQL database with dummy users for testing.

## 📦 What's Included

The `sql/seed.sql` file creates **30 dummy users**:
- ✅ **10 Students** (role: `student`)
- ✅ **10 Wardens** (role: `warden`)
- ✅ **10 Laundry Staff** (role: `staff`)

Plus supporting data:
- 5 Blocks (dormitory blocks)
- 7 Floors
- 10 Rooms
- 5 Laundry Services

## 🔑 Login Credentials

**All users have the same password:** `password123`

### Student Accounts
- Email: `student1@washos.com` to `student10@washos.com`
- Names: Raj Kumar, Priya Singh, Amit Patel, etc.

### Warden Accounts
- Email: `warden1@washos.com` to `warden10@washos.com`
- Names: Mr. Rajesh Sharma, Ms. Sunita Verma, etc.

### Laundry Staff Accounts
- Email: `laundry1@washos.com` to `laundry10@washos.com`
- Names: Ravi Kumar, Suresh Singh, Mahesh Patil, etc.

## 🚀 How to Run the Seed Script

### Option 1: Using the provided scripts (Recommended)

**On Linux/Mac:**
```bash
cd server
chmod +x run-seed.sh
./run-seed.sh
```

**On Windows:**
```cmd
cd server
run-seed.bat
```

### Option 2: Using psql directly

Make sure you have PostgreSQL client tools installed, then:

```bash
cd server
psql "postgresql://neondb_owner:npg_O5IE9LtCpyGN@ep-proud-hall-a1fh489a-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" -f sql/seed.sql
```

### Option 3: Using a database GUI

You can also run the seed file using database management tools:
- **DBeaver**: Connect to Neon DB → Open `sql/seed.sql` → Execute
- **pgAdmin**: Connect to Neon DB → Query Tool → Open file → Execute
- **DataGrip**: Connect to Neon DB → Open SQL file → Run

### Option 4: Manual copy-paste

1. Open `sql/seed.sql` in a text editor
2. Copy all contents
3. Connect to your Neon database via web console or psql
4. Paste and execute

## ✅ Verification

After running the seed script, you should see output like:

```
Students created: 10
Wardens created: 10
Laundry staff created: 10
Total users created: 30
```

You can also verify in your database:

```sql
SELECT role, COUNT(*) FROM users GROUP BY role;
```

Expected output:
```
   role   | count
----------+-------
 student  |    10
 warden   |    10
 staff    |    10
```

## 🔐 Security Note

⚠️ **Important:** These are dummy users with weak passwords for testing only!

Before deploying to production:
1. Delete all test users
2. Implement proper password hashing (bcrypt)
3. Use strong, unique passwords
4. Add email verification
5. Implement proper authentication

## 🧹 Cleanup (Optional)

To remove all seed data:

```sql
-- Delete in reverse order due to foreign keys
DELETE FROM laundry_staff WHERE user_id LIKE '70000000%';
DELETE FROM wardens WHERE user_id LIKE '60000000%';
DELETE FROM students WHERE user_id LIKE '50000000%';
DELETE FROM users WHERE id LIKE '50000000%' OR id LIKE '60000000%' OR id LIKE '70000000%';
DELETE FROM rooms WHERE id LIKE '30000000%';
DELETE FROM floors WHERE id LIKE '20000000%';
DELETE FROM blocks WHERE id LIKE '10000000%';
DELETE FROM laundry_services WHERE id LIKE '40000000%';
```

## 📝 Customization

To modify the seed data:
1. Edit `sql/seed.sql`
2. Change names, emails, phone numbers, etc.
3. Re-run the seed script

The script uses `ON CONFLICT DO NOTHING` to safely re-run without duplicates.
