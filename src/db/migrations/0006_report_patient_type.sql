ALTER TYPE patient_type ADD VALUE IF NOT EXISTS 'report';
--> statement-breakpoint
ALTER TYPE patient_type ADD VALUE IF NOT EXISTS 'report_new';
--> statement-breakpoint
ALTER TYPE patient_type ADD VALUE IF NOT EXISTS 'report_old';
--> statement-breakpoint
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS sms_template_report text;
--> statement-breakpoint
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS sms_template_report_new text;
--> statement-breakpoint
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS sms_template_report_old text;
