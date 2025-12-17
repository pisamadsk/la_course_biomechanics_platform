CREATE TABLE `analyses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`originalVideoKey` varchar(512) NOT NULL,
	`originalVideoUrl` varchar(1024) NOT NULL,
	`annotatedVideoKey` varchar(512),
	`annotatedVideoUrl` varchar(1024),
	`csvDataKey` varchar(512),
	`csvDataUrl` varchar(1024),
	`duration` float,
	`frameCount` int,
	`fps` float,
	`avgKneeAngleRight` float,
	`avgKneeAngleLeft` float,
	`avgHipAngleRight` float,
	`avgHipAngleLeft` float,
	`avgAnkleAngleRight` float,
	`avgAnkleAngleLeft` float,
	`avgKneeAsymmetry` float,
	`minKneeAngleRight` float,
	`maxKneeAngleRight` float,
	`minKneeAngleLeft` float,
	`maxKneeAngleLeft` float,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `analyses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analysisCharts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`analysisId` int NOT NULL,
	`chartType` varchar(64) NOT NULL,
	`chartKey` varchar(512) NOT NULL,
	`chartUrl` varchar(1024) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analysisCharts_id` PRIMARY KEY(`id`)
);
