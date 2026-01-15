-- Add retry settings to campaigns table
ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS retry_delay_minutes integer NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS max_daily_retries integer NOT NULL DEFAULT 5;

-- Add retry tracking to campaign_call_queue
ALTER TABLE public.campaign_call_queue
ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_attempt_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS next_retry_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS daily_retry_date date;

-- Add index for efficient retry queries
CREATE INDEX IF NOT EXISTS idx_campaign_call_queue_retry 
ON public.campaign_call_queue(next_retry_at, status, daily_retry_date)
WHERE status = 'retry_pending';

COMMENT ON COLUMN public.campaigns.retry_delay_minutes IS 'Minutes to wait before retrying unanswered calls';
COMMENT ON COLUMN public.campaigns.max_daily_retries IS 'Maximum retry attempts per lead per day';
COMMENT ON COLUMN public.campaign_call_queue.retry_count IS 'Number of retry attempts made today';
COMMENT ON COLUMN public.campaign_call_queue.next_retry_at IS 'When the next retry should be attempted';
COMMENT ON COLUMN public.campaign_call_queue.daily_retry_date IS 'Date for tracking daily retry limits';