import sqlite3

conn = sqlite3.connect('meetings.db')
cursor = conn.cursor()
cursor.execute("SELECT meeting_id, title, room_id, organizer_id, status FROM meetings")
for row in cursor.fetchall():
    print([row[0], row[1].encode('ascii', 'replace').decode('ascii'), row[2], row[3], row[4]])
