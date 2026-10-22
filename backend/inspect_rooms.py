import sqlite3

conn = sqlite3.connect('meetings.db')
cursor = conn.cursor()
cursor.execute("SELECT room_id, room_name, location, capacity FROM rooms")
for row in cursor.fetchall():
    print([row[0], row[1].encode('ascii', 'replace').decode('ascii'), row[2].encode('ascii', 'replace').decode('ascii'), row[3]])
