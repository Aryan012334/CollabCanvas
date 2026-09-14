-- Migration: add_cascade_deletes_and_shape_delete
--
-- WHAT:  Adds ON DELETE CASCADE to Shape, Chat, and RoomParticipant → Room
--        so that deleting a Room automatically removes all its children.
--
-- WHY:   Previously DELETE /room/:roomId would fail with a foreign-key
--        constraint error when shapes or chats existed.  The application
--        code now also explicitly deletes children first (belt-and-suspenders),
--        but the DB-level cascade ensures correctness even if the application
--        layer is bypassed.
--
-- SAFE:  The existing FK constraints are dropped and re-created with CASCADE.
--        No rows are modified; only the constraint definition changes.
-- ─────────────────────────────────────────────────────────────────────────────

-- Shape → Room: add ON DELETE CASCADE
ALTER TABLE "Shape" DROP CONSTRAINT IF EXISTS "Shape_roomId_fkey";
ALTER TABLE "Shape"
  ADD CONSTRAINT "Shape_roomId_fkey"
  FOREIGN KEY ("roomId")
  REFERENCES "Room"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- Chat → Room: add ON DELETE CASCADE
ALTER TABLE "Chat" DROP CONSTRAINT IF EXISTS "Chat_roomId_fkey";
ALTER TABLE "Chat"
  ADD CONSTRAINT "Chat_roomId_fkey"
  FOREIGN KEY ("roomId")
  REFERENCES "Room"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- RoomParticipant → Room: add ON DELETE CASCADE
ALTER TABLE "RoomParticipant" DROP CONSTRAINT IF EXISTS "RoomParticipant_roomId_fkey";
ALTER TABLE "RoomParticipant"
  ADD CONSTRAINT "RoomParticipant_roomId_fkey"
  FOREIGN KEY ("roomId")
  REFERENCES "Room"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
