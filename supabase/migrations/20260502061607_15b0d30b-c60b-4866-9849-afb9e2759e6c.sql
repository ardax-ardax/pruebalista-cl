-- Add reason field for when AI is disabled
ALTER TABLE public.global_settings
ADD COLUMN ai_disabled_reason text;

-- Remove per-user AI toggle (redundant with credits system)
ALTER TABLE public.user_usage
DROP COLUMN ai_enabled;