-- Add productive hours tracking to time_entries
ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS productive_minutes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS task_work_minutes integer DEFAULT 0;

-- Add waiting time tracking to tasks  
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS waiting_approval_minutes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS prompt_rejection_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS demo_rejection_count integer DEFAULT 0;

-- Create enhanced scoring function that calculates points based on performance
CREATE OR REPLACE FUNCTION public.calculate_task_score_v2(p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_task RECORD;
  v_prompt_time_minutes INTEGER;
  v_demo_time_minutes INTEGER;
  v_total_time_minutes INTEGER;
  v_prompt_edit_count INTEGER;
  v_demo_edit_count INTEGER;
  v_prompt_rejection_count INTEGER;
  v_demo_rejection_count INTEGER;
  v_waiting_minutes INTEGER;
  
  -- Score components (max 100 points)
  v_speed_score INTEGER := 0;       -- Max 35 points - how fast they completed
  v_quality_score INTEGER := 0;     -- Max 35 points - fewer edits = higher quality
  v_efficiency_score INTEGER := 0;  -- Max 30 points - fewer rejections
  
  v_final_score INTEGER;
  v_score_breakdown JSONB;
  v_base_points INTEGER;
  v_earned_points INTEGER;
BEGIN
  -- Get task details
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  v_base_points := COALESCE(v_task.points, 10);
  
  -- Calculate prompt creation time (from prompt_started_at to prompt_submitted_at)
  IF v_task.prompt_started_at IS NOT NULL AND v_task.prompt_submitted_at IS NOT NULL THEN
    v_prompt_time_minutes := GREATEST(1, EXTRACT(EPOCH FROM (v_task.prompt_submitted_at - v_task.prompt_started_at)) / 60);
  ELSE
    v_prompt_time_minutes := 0;
  END IF;
  
  -- Calculate demo time (from demo_started_at to demo_completed_at)
  IF v_task.demo_started_at IS NOT NULL AND v_task.demo_completed_at IS NOT NULL THEN
    v_demo_time_minutes := GREATEST(1, EXTRACT(EPOCH FROM (v_task.demo_completed_at - v_task.demo_started_at)) / 60);
  ELSE
    v_demo_time_minutes := 0;
  END IF;
  
  -- Calculate total task time (from picked_at to completed_at)
  IF v_task.picked_at IS NOT NULL AND v_task.completed_at IS NOT NULL THEN
    v_total_time_minutes := GREATEST(1, EXTRACT(EPOCH FROM (v_task.completed_at - v_task.picked_at)) / 60);
  ELSE
    v_total_time_minutes := 0;
  END IF;
  
  -- Get edit and rejection counts
  v_prompt_edit_count := COALESCE(v_task.prompt_edit_count, 0);
  v_demo_edit_count := COALESCE(v_task.demo_edit_count, 0);
  v_prompt_rejection_count := COALESCE(v_task.prompt_rejection_count, 0);
  v_demo_rejection_count := COALESCE(v_task.demo_rejection_count, 0);
  v_waiting_minutes := COALESCE(v_task.waiting_approval_minutes, 0);
  
  -- SPEED SCORE (max 35 points)
  -- Faster completion = more points
  -- Baseline: 60 minutes for full points, up to 180 minutes with decreasing points
  IF v_total_time_minutes > 0 THEN
    IF v_total_time_minutes <= 30 THEN
      v_speed_score := 35; -- Excellent: under 30 min
    ELSIF v_total_time_minutes <= 60 THEN
      v_speed_score := 30; -- Good: 30-60 min
    ELSIF v_total_time_minutes <= 90 THEN
      v_speed_score := 25; -- Average: 60-90 min
    ELSIF v_total_time_minutes <= 120 THEN
      v_speed_score := 20; -- Below average: 90-120 min
    ELSIF v_total_time_minutes <= 180 THEN
      v_speed_score := 15; -- Slow: 120-180 min
    ELSE
      v_speed_score := 10; -- Very slow: 180+ min
    END IF;
  END IF;
  
  -- QUALITY SCORE (max 35 points)
  -- Fewer edits after initial submission = higher quality
  -- Each edit reduces score by 5 points
  v_quality_score := GREATEST(0, 35 - ((v_prompt_edit_count + v_demo_edit_count) * 5));
  
  -- EFFICIENCY SCORE (max 30 points)
  -- Fewer rejections = more efficient work
  -- Each rejection reduces score by 10 points
  v_efficiency_score := GREATEST(0, 30 - ((v_prompt_rejection_count + v_demo_rejection_count) * 10));
  
  -- Calculate final score percentage (0-100)
  v_final_score := v_speed_score + v_quality_score + v_efficiency_score;
  
  -- Calculate earned points based on score percentage
  -- Score 90-100: 100% of base points
  -- Score 70-89: 80% of base points
  -- Score 50-69: 60% of base points
  -- Score 30-49: 40% of base points
  -- Score 0-29: 20% of base points
  IF v_final_score >= 90 THEN
    v_earned_points := v_base_points;
  ELSIF v_final_score >= 70 THEN
    v_earned_points := CEIL(v_base_points * 0.8);
  ELSIF v_final_score >= 50 THEN
    v_earned_points := CEIL(v_base_points * 0.6);
  ELSIF v_final_score >= 30 THEN
    v_earned_points := CEIL(v_base_points * 0.4);
  ELSE
    v_earned_points := CEIL(v_base_points * 0.2);
  END IF;
  
  -- Build score breakdown
  v_score_breakdown := jsonb_build_object(
    'speed_score', v_speed_score,
    'quality_score', v_quality_score,
    'efficiency_score', v_efficiency_score,
    'final_score', v_final_score,
    'base_points', v_base_points,
    'earned_points', v_earned_points,
    'prompt_time_minutes', v_prompt_time_minutes,
    'demo_time_minutes', v_demo_time_minutes,
    'total_time_minutes', v_total_time_minutes,
    'prompt_edit_count', v_prompt_edit_count,
    'demo_edit_count', v_demo_edit_count,
    'prompt_rejection_count', v_prompt_rejection_count,
    'demo_rejection_count', v_demo_rejection_count,
    'waiting_minutes', v_waiting_minutes,
    'max_possible', 100
  );
  
  RETURN v_score_breakdown;
END;
$function$;

-- Update the award_task_points trigger to use the new scoring
CREATE OR REPLACE FUNCTION public.award_task_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_score_breakdown JSONB;
  v_earned_points INTEGER;
BEGIN
  -- Only process when status changes to 'completed'
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.assigned_to IS NOT NULL THEN
    -- Calculate score using new function
    v_score_breakdown := calculate_task_score_v2(NEW.id);
    
    IF v_score_breakdown IS NOT NULL THEN
      v_earned_points := COALESCE((v_score_breakdown->>'earned_points')::INTEGER, NEW.points);
      
      -- Store the score breakdown
      NEW.score_breakdown := v_score_breakdown;
      NEW.final_score := COALESCE((v_score_breakdown->>'final_score')::INTEGER, 0);
      
      -- Update or insert engineer points with EARNED points (not base points)
      INSERT INTO public.engineer_points (engineer_id, total_points)
      VALUES (NEW.assigned_to, v_earned_points)
      ON CONFLICT (engineer_id) 
      DO UPDATE SET total_points = engineer_points.total_points + v_earned_points, updated_at = now();
      
      -- Log the transaction with earned points
      INSERT INTO public.point_transactions (engineer_id, points, task_id, description)
      VALUES (
        NEW.assigned_to, 
        v_earned_points, 
        NEW.id, 
        CONCAT('Completed task: ', NEW.title, ' (Score: ', (v_score_breakdown->>'final_score')::TEXT, '%)')
      );
    ELSE
      -- Fallback to original points if scoring fails
      INSERT INTO public.engineer_points (engineer_id, total_points)
      VALUES (NEW.assigned_to, NEW.points)
      ON CONFLICT (engineer_id) 
      DO UPDATE SET total_points = engineer_points.total_points + NEW.points, updated_at = now();
      
      INSERT INTO public.point_transactions (engineer_id, points, task_id, description)
      VALUES (NEW.assigned_to, NEW.points, NEW.id, CONCAT('Completed task: ', NEW.title));
    END IF;
    
    NEW.completed_at := now();
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create function to calculate productive hours for a day
CREATE OR REPLACE FUNCTION public.calculate_productive_hours(
  p_engineer_id uuid,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_time_entry RECORD;
  v_total_work_minutes INTEGER := 0;
  v_total_break_minutes INTEGER := 0;
  v_task_work_minutes INTEGER := 0;
  v_check_in_time TIMESTAMP WITH TIME ZONE;
  v_check_out_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get time entry for the date
  SELECT * INTO v_time_entry
  FROM time_entries
  WHERE engineer_id = p_engineer_id
    AND DATE(check_in_time) = p_date
    AND status = 'completed'
  ORDER BY check_in_time DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'date', p_date,
      'checked_in', false,
      'total_work_minutes', 0,
      'total_break_minutes', 0,
      'productive_minutes', 0,
      'task_work_minutes', 0
    );
  END IF;
  
  v_check_in_time := v_time_entry.check_in_time;
  v_check_out_time := COALESCE(v_time_entry.check_out_time, NOW());
  v_total_break_minutes := COALESCE(v_time_entry.total_break_minutes, 0);
  
  -- Total work time = check_out - check_in - breaks
  v_total_work_minutes := GREATEST(0, 
    EXTRACT(EPOCH FROM (v_check_out_time - v_check_in_time)) / 60 - v_total_break_minutes
  );
  
  -- Get task work minutes (time spent on actual task work)
  v_task_work_minutes := COALESCE(v_time_entry.task_work_minutes, 0);
  
  RETURN jsonb_build_object(
    'date', p_date,
    'checked_in', true,
    'check_in_time', v_check_in_time,
    'check_out_time', v_check_out_time,
    'total_work_minutes', v_total_work_minutes,
    'total_break_minutes', v_total_break_minutes,
    'productive_minutes', v_total_work_minutes,
    'task_work_minutes', v_task_work_minutes,
    'hours_formatted', CONCAT(
      FLOOR(v_total_work_minutes / 60)::TEXT, 'h ',
      (v_total_work_minutes % 60)::TEXT, 'm'
    )
  );
END;
$function$;