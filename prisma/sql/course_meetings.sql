-- Tabel kolaborasi per pertemuan (Zoom / Google Meet / Google Classroom / Teams).
-- Jalankan sekali: psql "$DATABASE_URL" -f prisma/sql/course_meetings.sql
-- atau cukup `npx prisma db push` karena model Meeting sudah ada di schema.

CREATE TABLE IF NOT EXISTS "Meeting" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Meeting_moduleId_provider_key"
    ON "Meeting"("moduleId", "provider");
CREATE INDEX IF NOT EXISTS "Meeting_courseId_idx" ON "Meeting"("courseId");
CREATE INDEX IF NOT EXISTS "Meeting_moduleId_idx" ON "Meeting"("moduleId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Meeting_courseId_fkey'
    ) THEN
        ALTER TABLE "Meeting"
            ADD CONSTRAINT "Meeting_courseId_fkey"
            FOREIGN KEY ("courseId") REFERENCES "Course"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Meeting_moduleId_fkey'
    ) THEN
        ALTER TABLE "Meeting"
            ADD CONSTRAINT "Meeting_moduleId_fkey"
            FOREIGN KEY ("moduleId") REFERENCES "Module"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
