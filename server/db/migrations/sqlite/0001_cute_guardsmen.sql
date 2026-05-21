CREATE TABLE `setups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`carId` integer NOT NULL,
	`name` text NOT NULL,
	`build` text DEFAULT ('{}') NOT NULL,
	`tune` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`carId`) REFERENCES `cars`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `setups_car_name_unq` ON `setups` (`carId`,`name`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `setupId` integer REFERENCES setups(id);--> statement-breakpoint
ALTER TABLE `sessions` ADD `setupSnapshot` text;