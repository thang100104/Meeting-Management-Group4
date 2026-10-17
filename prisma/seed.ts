import { PrismaClient, RoleName, UserStatus, RoomStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Seed Roles
  console.log('Creating Roles...');
  const adminRole = await prisma.role.upsert({
    where: { role_name: RoleName.Admin },
    update: {},
    create: { role_name: RoleName.Admin },
  });

  const organizerRole = await prisma.role.upsert({
    where: { role_name: RoleName.Organizer },
    update: {},
    create: { role_name: RoleName.Organizer },
  });

  const participantRole = await prisma.role.upsert({
    where: { role_name: RoleName.Participant },
    update: {},
    create: { role_name: RoleName.Participant },
  });

  // 2. Seed Departments
  console.log('Creating Departments...');
  const techDept = await prisma.department.upsert({
    where: { department_id: 1 },
    update: {},
    create: { department_id: 1, department_name: 'Phòng Kỹ thuật & Công nghệ', hrm_code: 'ENG' },
  });

  const bizDept = await prisma.department.upsert({
    where: { department_id: 2 },
    update: {},
    create: { department_id: 2, department_name: 'Phòng Kinh doanh & Marketing', hrm_code: 'BIZ' },
  });

  const hrDept = await prisma.department.upsert({
    where: { department_id: 3 },
    update: {},
    create: { department_id: 3, department_name: 'Phòng Nhân sự & Hành chính', hrm_code: 'HR' },
  });

  // 3. Seed Rooms
  console.log('Creating Rooms...');
  await prisma.room.upsert({
    where: { room_id: 1 },
    update: {},
    create: {
      room_id: 1,
      room_name: 'Phòng Hội nghị A',
      capacity: 30,
      location: 'Tầng 3 - Tòa nhà A',
      status: RoomStatus.Available,
    },
  });

  await prisma.room.upsert({
    where: { room_id: 2 },
    update: {},
    create: {
      room_id: 2,
      room_name: 'Phòng Họp Nhóm 1',
      capacity: 8,
      location: 'Tầng 2 - Tòa nhà A',
      status: RoomStatus.Available,
    },
  });

  await prisma.room.upsert({
    where: { room_id: 3 },
    update: {},
    create: {
      room_id: 3,
      room_name: 'Phòng VIP',
      capacity: 15,
      location: 'Tầng 4 - Tòa nhà B',
      status: RoomStatus.Available,
    },
  });

  await prisma.room.upsert({
    where: { room_id: 4 },
    update: {},
    create: {
      room_id: 4,
      room_name: 'Phòng 302 (Bảo trì)',
      capacity: 10,
      location: 'Tầng 3 - Tòa nhà B',
      status: RoomStatus.Maintenance,
    },
  });

  // 4. Seed Users with hashed password
  console.log('Creating Users...');
  const defaultPasswordHash = await bcrypt.hash('Password@123', 10);

  // Admin user
  await prisma.user.upsert({
    where: { email: 'admin@company.com' },
    update: {},
    create: {
      role_id: adminRole.role_id,
      department_id: techDept.department_id,
      full_name: 'Quản trị viên Hệ thống',
      email: 'admin@company.com',
      password_hash: defaultPasswordHash,
      phone: '0901000001',
      status: UserStatus.Active,
    },
  });

  // Organizers
  await prisma.user.upsert({
    where: { email: 'organizer1@company.com' },
    update: {},
    create: {
      role_id: organizerRole.role_id,
      department_id: techDept.department_id,
      full_name: 'Nguyễn Văn Tổ Chức',
      email: 'organizer1@company.com',
      password_hash: defaultPasswordHash,
      phone: '0901000002',
      status: UserStatus.Active,
    },
  });

  await prisma.user.upsert({
    where: { email: 'organizer2@company.com' },
    update: {},
    create: {
      role_id: organizerRole.role_id,
      department_id: bizDept.department_id,
      full_name: 'Trần Thị Điều Phối',
      email: 'organizer2@company.com',
      password_hash: defaultPasswordHash,
      phone: '0901000003',
      status: UserStatus.Active,
    },
  });

  // Participants
  await prisma.user.upsert({
    where: { email: 'staff1@company.com' },
    update: {},
    create: {
      role_id: participantRole.role_id,
      department_id: techDept.department_id,
      full_name: 'Lê Văn Nhân Viên',
      email: 'staff1@company.com',
      password_hash: defaultPasswordHash,
      phone: '0901000004',
      status: UserStatus.Active,
    },
  });

  await prisma.user.upsert({
    where: { email: 'staff2@company.com' },
    update: {},
    create: {
      role_id: participantRole.role_id,
      department_id: hrDept.department_id,
      full_name: 'Phạm Thị Thành Viên',
      email: 'staff2@company.com',
      password_hash: defaultPasswordHash,
      phone: '0901000005',
      status: UserStatus.Active,
    },
  });

  await prisma.user.upsert({
    where: { email: 'staff3@company.com' },
    update: {},
    create: {
      role_id: participantRole.role_id,
      department_id: bizDept.department_id,
      full_name: 'Hoàng Văn Dự Thính',
      email: 'staff3@company.com',
      password_hash: defaultPasswordHash,
      phone: '0901000006',
      status: UserStatus.Active,
    },
  });

  // Inactive user for testing rejection
  await prisma.user.upsert({
    where: { email: 'inactive@company.com' },
    update: {},
    create: {
      role_id: participantRole.role_id,
      department_id: techDept.department_id,
      full_name: 'Nhân Viên Nghỉ Việc',
      email: 'inactive@company.com',
      password_hash: defaultPasswordHash,
      phone: '0901000007',
      status: UserStatus.Inactive,
    },
  });

  console.log('✅ Seed completed successfully!');
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error('❌ Seed error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
