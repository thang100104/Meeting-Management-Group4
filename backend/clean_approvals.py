import sqlite3

conn = sqlite3.connect('meetings.db')
cursor = conn.cursor()
cursor.execute('DELETE FROM meeting_participants WHERE meeting_id IN (7, 8, 9)')
cursor.execute('DELETE FROM meeting_equipments WHERE meeting_id IN (7, 8, 9)')
cursor.execute('DELETE FROM meetings WHERE meeting_id IN (7, 8, 9)')
cursor.execute("UPDATE meetings SET status = 'SCHEDULED' WHERE status = 'PENDING'")
conn.commit()

cursor.execute('SELECT meeting_id, title, status, start_time FROM meetings')
for r in cursor.fetchall():
    print(r)
