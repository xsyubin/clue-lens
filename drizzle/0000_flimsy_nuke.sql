CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `clue_follow_ups` (
	`id` text PRIMARY KEY NOT NULL,
	`clue_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`next_action` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`clue_id`) REFERENCES `clues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `follow_ups_clue_idx` ON `clue_follow_ups` (`clue_id`);--> statement-breakpoint
CREATE INDEX `follow_ups_user_idx` ON `clue_follow_ups` (`user_id`);--> statement-breakpoint
CREATE TABLE `clue_mcp_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`trace_id` text NOT NULL,
	`operator_id` text NOT NULL,
	`role` text NOT NULL,
	`tool_name` text NOT NULL,
	`arguments` text,
	`status` text NOT NULL,
	`error_message` text,
	`execution_ms` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clue_timeline_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`clue_id` text NOT NULL,
	`operator_role` text NOT NULL,
	`operator_name` text NOT NULL,
	`action` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`comment` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`clue_id`) REFERENCES `monopoly_clues`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_timeline_clue_id` ON `clue_timeline_logs` (`clue_id`);--> statement-breakpoint
CREATE TABLE `clues` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_phone` text NOT NULL,
	`customer_company` text,
	`source` text DEFAULT 'WEBSITE' NOT NULL,
	`status` text DEFAULT 'NEW' NOT NULL,
	`intent_score` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `clues_user_idx` ON `clues` (`user_id`);--> statement-breakpoint
CREATE INDEX `clues_status_idx` ON `clues` (`status`);--> statement-breakpoint
CREATE INDEX `clues_created_at_idx` ON `clues` (`created_at`);--> statement-breakpoint
CREATE TABLE `monopoly_clues` (
	`id` text PRIMARY KEY NOT NULL,
	`clue_no` text NOT NULL,
	`discovery_date` text NOT NULL,
	`region` text NOT NULL,
	`source` text NOT NULL,
	`type` text NOT NULL,
	`target_name` text NOT NULL,
	`risk_level` text DEFAULT '中' NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`department` text,
	`handler` text,
	`deadline` text,
	`need_review` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'PENDING_ASSIGN' NOT NULL,
	`check_date` text,
	`check_result` text,
	`measures` text,
	`review_comment` text,
	`close_reason` text,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monopoly_clues_clue_no_unique` ON `monopoly_clues` (`clue_no`);--> statement-breakpoint
CREATE INDEX `idx_clues_clue_no` ON `monopoly_clues` (`clue_no`);--> statement-breakpoint
CREATE INDEX `idx_clues_region` ON `monopoly_clues` (`region`);--> statement-breakpoint
CREATE INDEX `idx_clues_type` ON `monopoly_clues` (`type`);--> statement-breakpoint
CREATE INDEX `idx_clues_status` ON `monopoly_clues` (`status`);--> statement-breakpoint
CREATE INDEX `idx_clues_target_name` ON `monopoly_clues` (`target_name`);--> statement-breakpoint
CREATE INDEX `idx_clues_discovery_date` ON `monopoly_clues` (`discovery_date`);--> statement-breakpoint
CREATE INDEX `idx_clues_user_id` ON `monopoly_clues` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `system_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`trace_id` text NOT NULL,
	`operator_role` text NOT NULL,
	`operator_id` text NOT NULL,
	`action` text NOT NULL,
	`target_id` text,
	`details` text,
	`ip_address` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_trace` ON `system_audit_logs` (`trace_id`);--> statement-breakpoint
CREATE TABLE `todos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `todos_user_idx` ON `todos` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text DEFAULT '综合管理人员' NOT NULL,
	`department` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
