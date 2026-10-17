import sys, os, io, json
from datetime import datetime, timedelta
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.db.init_db import init_db
from app.models.meeting import Meeting, MeetingParticipant
from app.models.equipment import Equipment, MeetingEquipment

GREEN = '\033[92m'; RED = '\033[91m'; YELLOW = '\033[93m'; CYAN = '\033[96m'; RESET = '\033[0m'; BOLD = '\033[1m'
results = []; PASS_COUNT = 0; FAIL_COUNT = 0

def record(tid, cat, desc, passed, actual=None, expected=None, note=''):
    global PASS_COUNT, FAIL_COUNT
    status = 'PASS' if passed else 'FAIL'
    if passed: PASS_COUNT += 1; icon = GREEN+'OK'+RESET
    else: FAIL_COUNT += 1; icon = RED+'FAIL'+RESET
    results.append({'id':tid,'category':cat,'description':desc,'status':status,'expected':str(expected),'actual':str(actual),'note':note})
    print(f'  [{icon}] [{tid}] {desc} | actual={actual}')

def header(t): print(f'\n{BOLD}{CYAN}== {t} =={RESET}')

def setup():
    db = SessionLocal()
    try:
        init_db(db)
        db.query(MeetingEquipment).delete(); db.query(MeetingParticipant).delete(); db.query(Meeting).delete()
        db.commit()
    finally: db.close()

def main():
    print(f'\n{BOLD}QA AGENT -- Full Test Suite -- {datetime.now()}{RESET}')
    setup()
    client = TestClient(app)
    tokens = {}

    header('PHASE 1 -- AUTH & RBAC')
    res = client.get('/health')
    record('T-A01','Auth','GET /health -> 200', res.status_code==200, res.status_code, 200)
    res = client.post('/api/v1/auth/login', json={'email':'admin@ictu.edu.vn','password':'123456'})
    ok = res.status_code==200 and 'access_token' in res.json()
    record('T-A02','Auth','Admin login -> 200+token', ok, res.status_code, 200)
    if ok: tokens['admin']=res.json()['access_token']; record('T-A02b','Auth','role==ADMIN', res.json().get('role')=='ADMIN', res.json().get('role'), 'ADMIN')
    res = client.post('/api/v1/auth/login', json={'email':'giangvien@ictu.edu.vn','password':'123456'})
    record('T-A03','Auth','Organizer login -> 200', res.status_code==200, res.status_code, 200)
    if res.status_code==200: tokens['organizer']=res.json()['access_token']
    res = client.post('/api/v1/auth/login', json={'email':'sinhvien@ictu.edu.vn','password':'123456'})
    record('T-A04','Auth','Participant login -> 200', res.status_code==200, res.status_code, 200)
    if res.status_code==200: tokens['participant']=res.json()['access_token']
    res = client.post('/api/v1/auth/login', json={'email':'admin@ictu.edu.vn','password':'wrong'})
    record('T-A05','Auth','Wrong password -> 400', res.status_code==400, res.status_code, 400)
    res = client.post('/api/v1/auth/login', json={'email':'notexist@ictu.edu.vn','password':'123456'})
    record('T-A06','Auth','Unknown email -> 400', res.status_code==400, res.status_code, 400)
    if 'admin' in tokens:
        h = {'Authorization': f"Bearer {tokens['admin']}"}
        res = client.get('/api/v1/auth/me', headers=h)
        record('T-A07','Auth','GET /auth/me valid token -> 200', res.status_code==200, res.status_code, 200)
        if res.status_code==200:
            d = res.json(); no_pw = 'password_hash' not in d and 'password' not in d
            record('T-A07b','Auth','auth/me does NOT expose password_hash', no_pw, str(d.keys()), 'no password_hash')
    res = client.get('/api/v1/auth/me')
    record('T-A08','Auth','GET /auth/me no token -> 401', res.status_code==401, res.status_code, 401)
    res = client.get('/api/v1/auth/me', headers={'Authorization':'Bearer fake.token.here'})
    record('T-A09','Auth','GET /auth/me fake token -> 401', res.status_code==401, res.status_code, 401)
    if 'admin' in tokens:
        h = {'Authorization': f"Bearer {tokens['admin']}"}
        res = client.post('/api/v1/auth/change-password', json={'old_password':'123456','new_password':'newpass123'}, headers=h)
        record('T-A10','Auth','change-password correct old -> 200', res.status_code==200, res.status_code, 200)
        if res.status_code==200:
            res2 = client.post('/api/v1/auth/change-password', json={'old_password':'newpass123','new_password':'123456'}, headers=h)
            record('T-A10b','Auth','Rollback admin password', res2.status_code==200, res2.status_code, 200)
    if 'organizer' in tokens:
        h = {'Authorization': f"Bearer {tokens['organizer']}"}
        res = client.post('/api/v1/auth/change-password', json={'old_password':'wrongold','new_password':'x'}, headers=h)
        record('T-A11','Auth','change-password wrong old -> 400', res.status_code==400, res.status_code, 400)
    if 'admin' in tokens:
        h = {'Authorization': f"Bearer {tokens['admin']}"}
        res = client.post('/api/v1/auth/logout', headers=h)
        record('T-A12','Auth','POST /auth/logout -> 200', res.status_code==200, res.status_code, 200)

    header('PHASE 2 -- ROOMS')
    admin_h = {'Authorization': f"Bearer {tokens.get('admin','')}"}
    org_h = {'Authorization': f"Bearer {tokens.get('organizer','')}"}
    part_h = {'Authorization': f"Bearer {tokens.get('participant','')}"}
    res = client.get('/api/v1/rooms', headers=org_h)
    record('T-R01','Rooms','GET /rooms Organizer -> 200', res.status_code==200, res.status_code, 200)
    rooms = res.json() if res.status_code==200 else []
    if rooms: record('T-R01b','Rooms',f'>=5 rooms seeded', len(rooms)>=5, len(rooms), '>=5')
    res2 = client.get('/api/v1/rooms?min_capacity=30', headers=org_h)
    if res2.status_code==200: all_ge30=all(r['capacity']>=30 for r in res2.json()); record('T-R02','Rooms','min_capacity=30 filter', all_ge30, f'all>=30:{all_ge30}', True)
    res3 = client.get('/api/v1/rooms?status=AVAILABLE', headers=org_h)
    if res3.status_code==200: all_a=all(r['status']=='AVAILABLE' for r in res3.json()); record('T-R03','Rooms','status=AVAILABLE filter', all_a, f'all_avail:{all_a}', True)
    if rooms:
        rid = rooms[0]['room_id']
        res4 = client.get(f'/api/v1/rooms/{rid}', headers=org_h)
        record('T-R04','Rooms',f'GET /rooms/{rid} -> 200', res4.status_code==200, res4.status_code, 200)
    payload_room = {'room_name':'QA Test Room 001','capacity':10,'location':'QA Bldg','status':'AVAILABLE'}
    res5 = client.post('/api/v1/rooms', json=payload_room, headers=admin_h)
    record('T-R05','Rooms','POST /rooms Admin -> 201', res5.status_code==201, res5.status_code, 201)
    qa_room_id = res5.json().get('room_id') if res5.status_code==201 else None
    if qa_room_id:
        res6 = client.post('/api/v1/rooms', json=payload_room, headers=admin_h)
        record('T-R06','Rooms','POST /rooms dup name -> 400', res6.status_code==400, res6.status_code, 400)
    res7 = client.post('/api/v1/rooms', json={'room_name':'Hack','capacity':5,'location':'X'}, headers=org_h)
    record('T-R07','Rooms','POST /rooms Organizer -> 403', res7.status_code==403, res7.status_code, 403)
    if qa_room_id:
        res8 = client.put(f'/api/v1/rooms/{qa_room_id}', json={'capacity':20}, headers=admin_h)
        record('T-R08','Rooms',f'PUT /rooms/{qa_room_id} Admin -> 200', res8.status_code==200, res8.status_code, 200)
    res9 = client.get('/api/v1/rooms/999999', headers=org_h)
    record('T-R09','Rooms','GET /rooms/999999 -> 404', res9.status_code==404, res9.status_code, 404)
    if qa_room_id:
        res10 = client.delete(f'/api/v1/rooms/{qa_room_id}', headers=admin_h)
        record('T-R10','Rooms',f'DELETE /rooms/{qa_room_id} Admin -> 200', res10.status_code==200, res10.status_code, 200)

    avail_rooms = [r for r in rooms if r.get('status')=='AVAILABLE']

    header('PHASE 3 -- MEETINGS & CONFLICT DETECTION')
    room_id = avail_rooms[0]['room_id'] if avail_rooms else None
    org_me = client.get('/api/v1/auth/me', headers=org_h).json()
    part_me = client.get('/api/v1/auth/me', headers=part_h).json()
    org_id = org_me.get('user_id'); part_id = part_me.get('user_id')
    mp = {'room_id':room_id,'title':'QA Meeting Alpha','description':'QA test','start_time':'2027-03-10T09:00:00','end_time':'2027-03-10T10:00:00','meeting_type':'IN_PERSON','participant_ids':[part_id] if part_id else []}
    if room_id:
        res = client.post('/api/v1/meetings', json=mp, headers=part_h)
        record('T-M01','Meetings','POST /meetings Participant -> 403', res.status_code==403, res.status_code, 403)
        res = client.post('/api/v1/meetings', json=mp, headers=org_h)
        record('T-M02','Meetings','POST /meetings Organizer -> 201', res.status_code==201, res.status_code, 201)
        m1id = None
        if res.status_code==201:
            m1id = res.json().get('meeting_id'); st = res.json().get('status')
            record('T-M02b','Meetings',f'Organizer meeting status=PENDING', st=='PENDING', st, 'PENDING')
        admp = dict(mp); admp['title']='QA Admin Meeting'; admp['start_time']='2027-03-11T09:00:00'; admp['end_time']='2027-03-11T10:00:00'
        res = client.post('/api/v1/meetings', json=admp, headers=admin_h)
        record('T-M03','Meetings','POST /meetings Admin -> 201', res.status_code==201, res.status_code, 201)
        m2id = None
        if res.status_code==201:
            m2id = res.json().get('meeting_id'); st2 = res.json().get('status')
            record('T-M03b','Meetings','Admin meeting status=SCHEDULED', st2=='SCHEDULED', st2, 'SCHEDULED')
        badtp = dict(mp); badtp['title']='Bad Time'; badtp['start_time']='2027-03-12T10:00:00'; badtp['end_time']='2027-03-12T09:00:00'
        res = client.post('/api/v1/meetings', json=badtp, headers=org_h)
        record('T-M04','Meetings','end_time < start_time -> 400', res.status_code==400, res.status_code, 400)
        badrp = dict(mp); badrp['room_id']=999999; badrp['title']='Bad Room'; badrp['start_time']='2027-03-13T09:00:00'; badrp['end_time']='2027-03-13T10:00:00'
        res = client.post('/api/v1/meetings', json=badrp, headers=org_h)
        record('T-M05','Meetings','room_id nonexistent -> 404', res.status_code==404, res.status_code, 404)
        if m1id:
            cfp = dict(mp); cfp['title']='QA Conflict'; cfp['start_time']='2027-03-10T09:30:00'; cfp['end_time']='2027-03-10T11:00:00'
            res = client.post('/api/v1/meetings', json=cfp, headers=org_h)
            record('T-M06','Meetings','Room conflict detection -> 409', res.status_code==409, res.status_code, 409, 'Must detect PENDING room conflict')
        res = client.get('/api/v1/meetings', headers=org_h)
        record('T-M07','Meetings','GET /meetings Organizer -> 200', res.status_code==200, res.status_code, 200)
        if m1id:
            res = client.get(f'/api/v1/meetings/{m1id}', headers=org_h)
            record('T-M08','Meetings',f'GET /meetings/{m1id} -> 200', res.status_code==200, res.status_code, 200)
        res = client.get('/api/v1/meetings/999999', headers=org_h)
        record('T-M09','Meetings','GET /meetings/999999 -> 404', res.status_code==404, res.status_code, 404)
        if m1id:
            res = client.patch(f'/api/v1/meetings/{m1id}/approve', headers=admin_h)
            record('T-M10','Meetings',f'approve Admin -> 200', res.status_code==200, res.status_code, 200)
        if m2id:
            res = client.patch(f'/api/v1/meetings/{m2id}/approve', headers=org_h)
            record('T-M11','Meetings','approve Organizer -> 403', res.status_code==403, res.status_code, 403)
        if m1id and part_id:
            res = client.patch(f'/api/v1/meetings/{m1id}/respond', json={'status':'ACCEPTED'}, headers=part_h)
            record('T-M12','Meetings','respond ACCEPTED Participant -> 200', res.status_code==200, res.status_code, 200)
        if m1id:
            res = client.patch(f'/api/v1/meetings/{m1id}/respond', json={'status':'INVALID_STATUS'}, headers=part_h)
            record('T-M13','Meetings','respond INVALID status -> 400', res.status_code==400, res.status_code, 400)
        if m1id:
            res = client.put(f'/api/v1/meetings/{m1id}', json={'description':'Updated by QA'}, headers=org_h)
            record('T-M14','Meetings','PUT meeting Organizer -> 200', res.status_code==200, res.status_code, 200)
            res = client.put(f'/api/v1/meetings/{m1id}', json={'description':'hack'}, headers=part_h)
            record('T-M15','Meetings','PUT meeting Participant -> 403', res.status_code==403, res.status_code, 403)
        cmp = dict(mp); cmp['title']='QA Cancel'; cmp['start_time']='2027-03-15T09:00:00'; cmp['end_time']='2027-03-15T10:00:00'
        res = client.post('/api/v1/meetings', json=cmp, headers=org_h)
        cm_id = res.json().get('meeting_id') if res.status_code==201 else None
        if cm_id:
            res = client.patch(f'/api/v1/meetings/{cm_id}/cancel', headers=org_h)
            record('T-M16','Meetings','cancel Organizer -> 200', res.status_code==200, res.status_code, 200)
        if m1id:
            res = client.patch(f'/api/v1/meetings/{m1id}/cancel', headers=part_h)
            record('T-M17','Meetings','cancel Participant -> 403', res.status_code==403, res.status_code, 403)
        maint_rooms = [r for r in rooms if r.get('status')=='MAINTENANCE']
        if maint_rooms:
            mmp = dict(mp); mmp['room_id']=maint_rooms[0]['room_id']; mmp['title']='Maint'; mmp['start_time']='2027-03-20T09:00:00'; mmp['end_time']='2027-03-20T10:00:00'
            res = client.post('/api/v1/meetings', json=mmp, headers=org_h)
            record('T-M18','Meetings','Book MAINTENANCE room -> 400', res.status_code==400, res.status_code, 400)

    header('PHASE 4 -- EQUIPMENT')
    res = client.get('/api/v1/equipments', headers=org_h)
    record('T-E01','Equipment','GET /equipments Organizer -> 200', res.status_code==200, res.status_code, 200)
    equipments = res.json() if res.status_code==200 else []
    if equipments: record('T-E01b','Equipment',f'>=10 equipments seeded', len(equipments)>=10, len(equipments), '>=10')
    res2 = client.get('/api/v1/equipments?equipment_type=PROJECTOR', headers=org_h)
    if res2.status_code==200: ap=all(e['equipment_type']=='PROJECTOR' for e in res2.json()); record('T-E02','Equipment','PROJECTOR filter', ap, f'all_prj:{ap}', True)
    res3 = client.get('/api/v1/equipments?is_portable=true', headers=org_h)
    if res3.status_code==200: ap2=all(e['room_id'] is None for e in res3.json()); record('T-E03','Equipment','portable filter', ap2, f'all_port:{ap2}', True)
    res4 = client.get('/api/v1/equipments/stats/summary', headers=admin_h)
    record('T-E04','Equipment','GET stats/summary -> 200', res4.status_code==200, res4.status_code, 200)
    if res4.status_code==200:
        d4=res4.json(); to=isinstance(d4.get('total'),int) and d4['total']>0
        record('T-E04b','Equipment','stats.total > 0', to, d4.get('total'), '>0')
    new_eq = {'equipment_name':'QA Projector Test 999','equipment_type':'PROJECTOR','serial_number':'QA-PRJ-TEST-999','status':'AVAILABLE','description':'QA Agent'}
    res5 = client.post('/api/v1/equipments', json=new_eq, headers=admin_h)
    record('T-E05','Equipment','POST /equipments Admin -> 201', res5.status_code==201, res5.status_code, 201)
    qa_eq_id = res5.json().get('equipment_id') if res5.status_code==201 else None
    if qa_eq_id:
        res6 = client.post('/api/v1/equipments', json=new_eq, headers=admin_h)
        record('T-E06','Equipment','dup serial -> 400', res6.status_code==400, res6.status_code, 400)
    res7 = client.post('/api/v1/equipments', json={'equipment_name':'H','equipment_type':'OTHER','serial_number':'HH01'}, headers=org_h)
    record('T-E07','Equipment','POST /equipments Organizer -> 403', res7.status_code==403, res7.status_code, 403)
    if qa_eq_id:
        res8 = client.put(f'/api/v1/equipments/{qa_eq_id}', json={'description':'Updated'}, headers=admin_h)
        record('T-E08','Equipment',f'PUT equipment Admin -> 200', res8.status_code==200, res8.status_code, 200)
        res9 = client.get(f'/api/v1/equipments/{qa_eq_id}', headers=org_h)
        record('T-E09','Equipment',f'GET equipment detail -> 200', res9.status_code==200, res9.status_code, 200)
    res10 = client.get('/api/v1/equipments/999999', headers=org_h)
    record('T-E10','Equipment','GET equipment nonexist -> 404', res10.status_code==404, res10.status_code, 404)
    avail_eqs = [e for e in equipments if e.get('status')=='AVAILABLE']
    broken_eqs = [e for e in equipments if e.get('status')!='AVAILABLE']
    if broken_eqs and room_id:
        bep = {'room_id':room_id,'title':'QA Broken Eq','start_time':'2027-04-01T09:00:00','end_time':'2027-04-01T10:00:00','equipment_ids':[broken_eqs[0]['equipment_id']]}
        res = client.post('/api/v1/meetings', json=bep, headers=org_h)
        record('T-E11','Equipment','Book MAINTENANCE/BROKEN equipment -> 400', res.status_code==400, res.status_code, 400)
    meq_id = None
    if avail_eqs and room_id:
        eqp = {'room_id':room_id,'title':'QA Eq Meeting','start_time':'2027-04-05T09:00:00','end_time':'2027-04-05T10:00:00','equipment_ids':[avail_eqs[0]['equipment_id']]}
        res = client.post('/api/v1/meetings', json=eqp, headers=org_h)
        record('T-E12','Equipment','Book meeting with AVAILABLE equipment -> 201', res.status_code==201, res.status_code, 201)
        meq_id = res.json().get('meeting_id') if res.status_code==201 else None
    if meq_id and avail_eqs and avail_rooms:
        r2 = avail_rooms[1]['room_id'] if len(avail_rooms)>1 else room_id
        cfep = {'room_id':r2,'title':'QA Eq Conflict','start_time':'2027-04-05T09:30:00','end_time':'2027-04-05T11:00:00','equipment_ids':[avail_eqs[0]['equipment_id']]}
        res = client.post('/api/v1/meetings', json=cfep, headers=org_h)
        record('T-E13','Equipment','Equipment time conflict -> 409', res.status_code==409, res.status_code, 409, 'Equipment conflict detection')
    if meq_id:
        res = client.patch(f'/api/v1/meetings/{meq_id}/cancel', headers=org_h)
        record('T-E14','Equipment','Cancel meeting with equipment -> 200', res.status_code==200, res.status_code, 200)
    if qa_eq_id:
        res = client.get(f'/api/v1/equipments/{qa_eq_id}/history', headers=org_h)
        record('T-E15','Equipment','GET equipment history -> 200', res.status_code==200, res.status_code, 200)
        res = client.delete(f'/api/v1/equipments/{qa_eq_id}', headers=admin_h)
        record('T-E16','Equipment','DELETE equipment Admin -> 200', res.status_code==200, res.status_code, 200)

    header('PHASE 5 -- USERS')
    res = client.get('/api/v1/users', headers=admin_h)
    record('T-U01','Users','GET /users Admin -> 200', res.status_code==200, res.status_code, 200)
    res = client.get('/api/v1/users', headers=org_h)
    record('T-U02','Users','GET /users Organizer -> 403', res.status_code==403, res.status_code, 403)
    nup = {'email':'qa_test_user@ictu.edu.vn','password':'qatest123','full_name':'QA Test User','role_id':3,'status':'ACTIVE'}
    res = client.post('/api/v1/users', json=nup, headers=admin_h)
    ok3 = res.status_code in [201,400]
    record('T-U03','Users','POST /users Admin -> 201 or 400', ok3, res.status_code, '201 or 400')
    nuid = res.json().get('user_id') if res.status_code==201 else None
    res = client.post('/api/v1/users', json=nup, headers=admin_h)
    record('T-U04','Users','POST /users dup email -> 400', res.status_code==400, res.status_code, 400)
    res = client.post('/api/v1/users', json={'email':'h@x.com','password':'abc','full_name':'H','role_id':2}, headers=org_h)
    record('T-U05','Users','POST /users Organizer -> 403', res.status_code==403, res.status_code, 403)
    ome2 = client.get('/api/v1/auth/me', headers=org_h).json(); oid2 = ome2.get('user_id')
    if oid2:
        res = client.get(f'/api/v1/users/{oid2}', headers=org_h)
        record('T-U06','Users','GET own user Organizer -> 200', res.status_code==200, res.status_code, 200)
    if nuid:
        res = client.get(f'/api/v1/users/{nuid}', headers=org_h)
        record('T-U07','Users','GET other user Organizer -> 403', res.status_code==403, res.status_code, 403)
        res = client.delete(f'/api/v1/users/{nuid}', headers=admin_h)
        record('T-U08','Users','DELETE user Admin -> 200 (soft)', res.status_code==200, res.status_code, 200)
    res = client.get('/api/v1/meetings/search-users?q=nguyen', headers=org_h)
    record('T-U09','Users','search-users -> 200', res.status_code==200, res.status_code, 200)

    header('PHASE 6 -- EDGE CASES')
    res = client.post('/api/v1/meetings', json={'room_id':1,'start_time':'2027-05-01T09:00:00','end_time':'2027-05-01T10:00:00'}, headers=org_h)
    record('T-EC01','EdgeCase','Missing title -> 422', res.status_code==422, res.status_code, 422)
    res = client.post('/api/v1/meetings', json={'room_id':1,'title':'X','start_time':'2027-05-02T09:00:00','end_time':'2027-05-02T09:00:00'}, headers=org_h)
    record('T-EC02','EdgeCase','start_time==end_time -> 400', res.status_code==400, res.status_code, 400)
    res = client.get('/api/v1/nonexistent', headers=org_h)
    record('T-EC03','EdgeCase','Unknown endpoint -> 404', res.status_code==404, res.status_code, 404)
    res = client.get('/health')
    ct = res.headers.get('content-type','')
    record('T-EC04','EdgeCase','health Content-Type=JSON', 'application/json' in ct, ct, 'application/json')
    res = client.get('/api/v1/meetings/-1', headers=org_h)
    record('T-EC05','EdgeCase','GET meetings/-1 -> 404 or 422', res.status_code in [404,422], res.status_code, '404 or 422')
    res = client.get('/api/v1/equipments?from_time=2027-04-05T09:00:00&to_time=2027-04-05T10:00:00', headers=org_h)
    record('T-EC06','EdgeCase','equipments with time filter -> 200', res.status_code==200, res.status_code, 200)
    if res.status_code==200:
        haf=all('is_available_in_slot' in e for e in res.json())
        record('T-EC06b','EdgeCase','field is_available_in_slot present', haf, f'all:{haf}', True)
    res = client.get('/api/v1/equipments?from_time=2027-04-05T11:00:00&to_time=2027-04-05T09:00:00', headers=org_h)
    record('T-EC07','EdgeCase','from_time > to_time -> 400', res.status_code==400, res.status_code, 400)

    total = PASS_COUNT+FAIL_COUNT
    rate = round(PASS_COUNT/total*100,1) if total>0 else 0
    print(f'\n{BOLD}== RESULT SUMMARY =={RESET}')
    print(f'  Total: {total} | PASS: {GREEN}{PASS_COUNT}{RESET} | FAIL: {RED}{FAIL_COUNT}{RESET} | Rate: {rate}%')
    if FAIL_COUNT:
        print(f'\n{RED}{BOLD}FAILED TESTS:{RESET}')
        for r in results:
            if r['status']=='FAIL':
                note = f" | NOTE: {r['note']}" if r.get('note') else ''
                print(f"  [{r['id']}] {r['category']} -- {r['description']}")
                print(f"       Expected={r['expected']} | Actual={r['actual']}{note}")
    rp = os.path.join(os.path.dirname(os.path.abspath('.')), 'backend', 'qa_report.json')
    with open(rp,'w',encoding='utf-8') as f:
        json.dump({'summary':{'total':total,'pass':PASS_COUNT,'fail':FAIL_COUNT,'pass_rate':rate,'timestamp':datetime.now().isoformat()},'results':results},f,ensure_ascii=False,indent=2)
    print(f'\n  Report saved: {rp}')
    return FAIL_COUNT

if __name__=='__main__':
    fc=main(); sys.exit(0 if fc==0 else 1)
