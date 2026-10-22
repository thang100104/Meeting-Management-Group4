import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'meetings.db')
print(f"Connecting to database: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 1. Delete meeting-related records
cursor.execute("DELETE FROM meeting_participants")
cursor.execute("DELETE FROM meeting_equipments")
cursor.execute("DELETE FROM meetings")
print("Deleted all meetings, meeting_participants, and meeting_equipments.")

# 2. Reset equipment room assignments to NULL
cursor.execute("UPDATE equipments SET room_id = NULL")
print("Reset equipment room assignments to NULL.")

# 3. Delete room restrictions and rooms
cursor.execute("DELETE FROM room_restrictions")
cursor.execute("DELETE FROM rooms")
print("Deleted all room_restrictions and rooms.")

# 4. Reset sqlite_sequence for cleaned tables
for table in ['meetings', 'meeting_participants', 'meeting_equipments', 'rooms', 'room_restrictions']:
    try:
        cursor.execute("DELETE FROM sqlite_sequence WHERE name = ?", (table,))
    except sqlite3.OperationalError:
        pass
print("Reset auto-increment sequences.")

conn.commit()

# 5. Verify final counts
tables = ['roles', 'departments', 'users', 'equipments', 'rooms', 'room_restrictions', 'meetings', 'meeting_participants', 'meeting_equipments']
print("\n--- FINAL TABLE ROW COUNTS ---")
for t in tables:
    cursor.execute(f"SELECT count(*) FROM {t}")
    count = cursor.fetchone()[0]
    print(f"  {t}: {count}")

conn.close()
print("\nDatabase cleanup completed successfully!")
