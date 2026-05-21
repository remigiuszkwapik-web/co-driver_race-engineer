PRAGMA foreign_keys=OFF;--> statement-breakpoint
UPDATE `sessions` SET `setupId` = NULL, `setupSnapshot` = NULL;--> statement-breakpoint
DROP TABLE `setups`;--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`eventId` integer NOT NULL,
	`carId` integer NOT NULL,
	`tuneLabel` text,
	`piAtStart` integer NOT NULL,
	`startedAt` integer NOT NULL,
	`endedAt` integer,
	FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`carId`) REFERENCES `cars`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("id", "eventId", "carId", "tuneLabel", "piAtStart", "startedAt", "endedAt") SELECT "id", "eventId", "carId", "tuneLabel", "piAtStart", "startedAt", "endedAt" FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;