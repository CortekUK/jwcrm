ALTER TABLE quarterly_reviews
ADD COLUMN custom_fields JSONB DEFAULT '{}'::jsonb;
