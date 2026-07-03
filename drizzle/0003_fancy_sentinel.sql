ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "parts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "movements_reverses_movement_id_unique" ON "movements" USING btree ("reverses_movement_id") WHERE "movements"."reverses_movement_id" IS NOT NULL;