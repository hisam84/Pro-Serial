ALTER TABLE doctors
ADD COLUMN IF NOT EXISTS sms_template_new text,
ADD COLUMN IF NOT EXISTS sms_template_old text;
--> statement-breakpoint
UPDATE doctors
SET sms_template_new = sms_template,
    sms_template_old = sms_template
WHERE sms_template IS NOT NULL
  AND sms_template_new IS NULL
  AND sms_template_old IS NULL;
