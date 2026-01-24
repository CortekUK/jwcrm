-- Create will_status_events table to log all status transitions
CREATE TABLE public.will_status_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  will_id uuid NOT NULL REFERENCES public.wills(id) ON DELETE CASCADE,
  previous_status will_status,
  new_status will_status NOT NULL,
  actor_user_id uuid NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text
);

-- Enable RLS
ALTER TABLE public.will_status_events ENABLE ROW LEVEL SECURITY;

-- Create index for performance
CREATE INDEX idx_will_status_events_will_id ON public.will_status_events(will_id);

-- RLS Policies: Only admins can view status events
CREATE POLICY "Admins can view all status events"
ON public.will_status_events
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies: Only admins can insert status events
CREATE POLICY "Admins can insert status events"
ON public.will_status_events
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Update wills table to allow admins to update status
CREATE POLICY "Admins can update wills"
ON public.wills
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));
