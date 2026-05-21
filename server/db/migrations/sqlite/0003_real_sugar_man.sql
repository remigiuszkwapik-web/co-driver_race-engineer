CREATE TABLE `builds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`carId` integer NOT NULL,
	`name` text NOT NULL,
	`settings` text DEFAULT ('{}') NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`carId`) REFERENCES `cars`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `builds_car_name_unq` ON `builds` (`carId`,`name`);--> statement-breakpoint
CREATE TABLE `tunes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`buildId` integer NOT NULL,
	`name` text NOT NULL,
	`settings` text DEFAULT ('{}') NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`buildId`) REFERENCES `builds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tunes_build_name_unq` ON `tunes` (`buildId`,`name`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `buildId` integer REFERENCES builds(id);--> statement-breakpoint
ALTER TABLE `sessions` ADD `buildSnapshot` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `tuneId` integer REFERENCES tunes(id);--> statement-breakpoint
ALTER TABLE `sessions` ADD `tuneSnapshot` text;