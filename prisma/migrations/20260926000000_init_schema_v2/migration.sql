-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('Admin', 'Organizer', 'Participant');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('Active', 'Inactive');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('Available', 'Maintenance');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('Scheduled', 'In_progress', 'Completed', 'Cancelled');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('Pending', 'Accepted', 'Declined', 'Tentative');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('Available', 'Booked', 'Maintenance');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('Invite', 'Update', 'Cancel', 'Reminder');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('Email');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('Sent', 'Failed');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('Pending', 'Sent', 'Failed', 'Cancelled');

-- CreateTable
CREATE TABLE "DEPARTMENT" (
    "department_id" SERIAL NOT NULL,
    "department_name" VARCHAR(100) NOT NULL,
    "hrm_code" VARCHAR(50),

    CONSTRAINT "DEPARTMENT_pkey" PRIMARY KEY ("department_id")
);

-- CreateTable
CREATE TABLE "ROLE" (
    "role_id" SERIAL NOT NULL,
    "role_name" "RoleName" NOT NULL,

    CONSTRAINT "ROLE_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "USER" (
    "user_id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "department_id" INTEGER,
    "full_name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password_hash" VARCHAR(255),
    "phone" VARCHAR(30),
    "status" "UserStatus" NOT NULL DEFAULT 'Active',

    CONSTRAINT "USER_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "ROOM" (
    "room_id" SERIAL NOT NULL,
    "room_name" VARCHAR(100) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "location" VARCHAR(200),
    "status" "RoomStatus" NOT NULL DEFAULT 'Available',

    CONSTRAINT "ROOM_pkey" PRIMARY KEY ("room_id")
);

-- CreateTable
CREATE TABLE "ROOM_RESTRICTION" (
    "restriction_id" SERIAL NOT NULL,
    "room_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "ROOM_RESTRICTION_pkey" PRIMARY KEY ("restriction_id")
);

-- CreateTable
CREATE TABLE "MEETING" (
    "meeting_id" SERIAL NOT NULL,
    "organizer_id" INTEGER NOT NULL,
    "room_id" INTEGER,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "meeting_link" TEXT,
    "start_time" TIMESTAMPTZ(6) NOT NULL,
    "end_time" TIMESTAMPTZ(6) NOT NULL,
    "reminder_minutes_before" INTEGER NOT NULL DEFAULT 15,
    "status" "MeetingStatus" NOT NULL DEFAULT 'Scheduled',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "cancelled_at" TIMESTAMPTZ(6),
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrence_rule" TEXT,

    CONSTRAINT "MEETING_pkey" PRIMARY KEY ("meeting_id")
);

-- CreateTable
CREATE TABLE "MEETING_PARTICIPANT" (
    "participant_id" SERIAL NOT NULL,
    "meeting_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'Pending',
    "rsvp_token_hash" VARCHAR(255),
    "rsvp_token_expires_at" TIMESTAMPTZ(6),

    CONSTRAINT "MEETING_PARTICIPANT_pkey" PRIMARY KEY ("participant_id")
);

-- CreateTable
CREATE TABLE "MEETING_ATTACHMENT" (
    "attachment_id" SERIAL NOT NULL,
    "meeting_id" INTEGER NOT NULL,
    "uploaded_by" INTEGER NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "storage_key" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MEETING_ATTACHMENT_pkey" PRIMARY KEY ("attachment_id")
);

-- CreateTable
CREATE TABLE "MEETING_REMINDER" (
    "reminder_id" SERIAL NOT NULL,
    "meeting_id" INTEGER NOT NULL,
    "recipient_user_id" INTEGER NOT NULL,
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'Pending',
    "sent_at" TIMESTAMPTZ(6),
    "error_message" TEXT,

    CONSTRAINT "MEETING_REMINDER_pkey" PRIMARY KEY ("reminder_id")
);

-- CreateTable
CREATE TABLE "NOTIFICATION_LOG" (
    "log_id" SERIAL NOT NULL,
    "meeting_id" INTEGER NOT NULL,
    "recipient_user_id" INTEGER NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'Invite',
    "channel" "NotificationChannel" NOT NULL DEFAULT 'Email',
    "status" "NotificationStatus" NOT NULL,
    "sent_at" TIMESTAMPTZ(6),
    "error_message" TEXT,

    CONSTRAINT "NOTIFICATION_LOG_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "EQUIPMENT" (
    "equipment_id" SERIAL NOT NULL,
    "room_id" INTEGER,
    "equipment_name" VARCHAR(100) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'Available',

    CONSTRAINT "EQUIPMENT_pkey" PRIMARY KEY ("equipment_id")
);

-- CreateTable
CREATE TABLE "MEETING_EQUIPMENT" (
    "meeting_id" INTEGER NOT NULL,
    "equipment_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "MEETING_EQUIPMENT_pkey" PRIMARY KEY ("meeting_id","equipment_id")
);

-- CreateTable
CREATE TABLE "CHECK_IN_LOG" (
    "log_id" SERIAL NOT NULL,
    "meeting_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "check_in_time" TIMESTAMPTZ(6),
    "check_out_time" TIMESTAMPTZ(6),
    "qr_code_data" TEXT,

    CONSTRAINT "CHECK_IN_LOG_pkey" PRIMARY KEY ("log_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ROLE_role_name_key" ON "ROLE"("role_name");

-- CreateIndex
CREATE UNIQUE INDEX "USER_email_key" ON "USER"("email");

-- CreateIndex
CREATE INDEX "USER_role_id_idx" ON "USER"("role_id");

-- CreateIndex
CREATE INDEX "USER_status_idx" ON "USER"("status");

-- CreateIndex
CREATE INDEX "MEETING_room_id_start_time_end_time_status_idx" ON "MEETING"("room_id", "start_time", "end_time", "status");

-- CreateIndex
CREATE INDEX "MEETING_start_time_end_time_organizer_id_idx" ON "MEETING"("start_time", "end_time", "organizer_id");

-- CreateIndex
CREATE UNIQUE INDEX "MEETING_PARTICIPANT_rsvp_token_hash_key" ON "MEETING_PARTICIPANT"("rsvp_token_hash");

-- CreateIndex
CREATE INDEX "MEETING_PARTICIPANT_user_id_status_idx" ON "MEETING_PARTICIPANT"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MEETING_PARTICIPANT_meeting_id_user_id_key" ON "MEETING_PARTICIPANT"("meeting_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "MEETING_ATTACHMENT_storage_key_key" ON "MEETING_ATTACHMENT"("storage_key");

-- CreateIndex
CREATE INDEX "MEETING_ATTACHMENT_meeting_id_idx" ON "MEETING_ATTACHMENT"("meeting_id");

-- CreateIndex
CREATE INDEX "MEETING_REMINDER_status_scheduled_at_idx" ON "MEETING_REMINDER"("status", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "MEETING_REMINDER_meeting_id_recipient_user_id_key" ON "MEETING_REMINDER"("meeting_id", "recipient_user_id");

-- CreateIndex
CREATE INDEX "NOTIFICATION_LOG_meeting_id_recipient_user_id_idx" ON "NOTIFICATION_LOG"("meeting_id", "recipient_user_id");

-- AddForeignKey
ALTER TABLE "USER" ADD CONSTRAINT "USER_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "ROLE"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "USER" ADD CONSTRAINT "USER_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "DEPARTMENT"("department_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ROOM_RESTRICTION" ADD CONSTRAINT "ROOM_RESTRICTION_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "ROOM"("room_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ROOM_RESTRICTION" ADD CONSTRAINT "ROOM_RESTRICTION_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "ROLE"("role_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MEETING" ADD CONSTRAINT "MEETING_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "USER"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MEETING" ADD CONSTRAINT "MEETING_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "ROOM"("room_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MEETING_PARTICIPANT" ADD CONSTRAINT "MEETING_PARTICIPANT_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "MEETING"("meeting_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MEETING_PARTICIPANT" ADD CONSTRAINT "MEETING_PARTICIPANT_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USER"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MEETING_ATTACHMENT" ADD CONSTRAINT "MEETING_ATTACHMENT_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "MEETING"("meeting_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MEETING_ATTACHMENT" ADD CONSTRAINT "MEETING_ATTACHMENT_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "USER"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MEETING_REMINDER" ADD CONSTRAINT "MEETING_REMINDER_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "MEETING"("meeting_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MEETING_REMINDER" ADD CONSTRAINT "MEETING_REMINDER_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "USER"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NOTIFICATION_LOG" ADD CONSTRAINT "NOTIFICATION_LOG_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "MEETING"("meeting_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NOTIFICATION_LOG" ADD CONSTRAINT "NOTIFICATION_LOG_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "USER"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EQUIPMENT" ADD CONSTRAINT "EQUIPMENT_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "ROOM"("room_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MEETING_EQUIPMENT" ADD CONSTRAINT "MEETING_EQUIPMENT_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "MEETING"("meeting_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MEETING_EQUIPMENT" ADD CONSTRAINT "MEETING_EQUIPMENT_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "EQUIPMENT"("equipment_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CHECK_IN_LOG" ADD CONSTRAINT "CHECK_IN_LOG_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "MEETING"("meeting_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CHECK_IN_LOG" ADD CONSTRAINT "CHECK_IN_LOG_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USER"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
