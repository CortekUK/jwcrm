-- Allow clients to view status events for their own wills
CREATE POLICY "Users can view status events for their own wills"
ON public.will_status_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.wills
    WHERE wills.id = will_status_events.will_id
    AND wills.user_id = auth.uid()
  )
);
