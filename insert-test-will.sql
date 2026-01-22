-- SQL Script to insert a complete test will with all attributes filled
-- This will create a complete will entry with client approval status for testing

-- First, let's assume we have a test user (replace with your actual user_id)
-- If you need to create a test user first, uncomment and run these:
/*
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  '3260e7ae-3d2a-4b2a-a21b-04d76f301010',
  'testclient@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
);

INSERT INTO public.profiles (user_id, full_name, locale, created_at, updated_at)
VALUES (
  '3260e7ae-3d2a-4b2a-a21b-04d76f301010',
  'Client Demo',
  'en',
  NOW(),
  NOW()
);
*/

-- Insert a complete will with all data
INSERT INTO public.wills (
  id,
  user_id,
  status,
  submitted_at,
  pdf_path,
  pdf_generated_at,
  visible_to_client,
  client_approval_status,
  client_approval_at,
  client_approval_comments,
  answers,
  upload_files,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  '3260e7ae-3d2a-4b2a-a21b-04d76f301010', -- Replace with your actual user_id
  'draft_released', -- Status that shows client review is available
  NOW() - INTERVAL '5 days',
  'wills/3260e7ae-3d2a-4b2a-a21b-04d76f301010/draft_1729084928000.pdf',
  NOW() - INTERVAL '2 days',
  TRUE,
  'disapproved', -- Client has disapproved/requested changes
  NOW() - INTERVAL '1 day',
  'I would like to change the distribution percentages for my beneficiaries. Also, please update the executor contact information for my brother.',
  jsonb_build_object(
    'personal', jsonb_build_object(
      'full_name', 'John Michael Smith',
      'religion', 'Muslim',
      'marital_status', 'Married',
      'address', '123 Main Street, Apartment 4B, London, UK, SW1A 1AA',
      'email', 'john.smith@example.com',
      'contact_number', '+44 20 7946 0958',
      'date_of_birth', '1980-05-15',
      'nationality', 'British',
      'passport_number', 'GB123456789'
    ),
    'executors', jsonb_build_array(
      jsonb_build_object(
        'name', 'Sarah Johnson',
        'relation', 'Spouse',
        'email', 'sarah.johnson@example.com',
        'contact_number', '+44 20 7946 0123',
        'passport_number', 'GB987654321',
        'level', 1
      ),
      jsonb_build_object(
        'name', 'David Smith',
        'relation', 'Brother',
        'email', 'david.smith@example.com',
        'contact_number', '+44 20 7946 0456',
        'passport_number', 'GB456789123',
        'level', 2
      ),
      jsonb_build_object(
        'name', 'Emily Brown',
        'relation', 'Sister',
        'email', 'emily.brown@example.com',
        'contact_number', '+44 20 7946 0789',
        'passport_number', 'GB789123456',
        'level', 3
      )
    ),
    'executor_permission_to_contact', TRUE,
    'beneficiaries', jsonb_build_array(
      jsonb_build_object(
        'name', 'Michael Smith Jr',
        'relationship', 'Son',
        'percentage', 40,
        'passport_number', 'GB111222333',
        'level', 1,
        'comments', 'Primary beneficiary - eldest son'
      ),
      jsonb_build_object(
        'name', 'Emma Smith',
        'relationship', 'Daughter',
        'percentage', 35,
        'passport_number', 'GB444555666',
        'level', 1,
        'comments', 'Primary beneficiary - daughter'
      ),
      jsonb_build_object(
        'name', 'James Smith',
        'relationship', 'Son',
        'percentage', 25,
        'passport_number', 'GB777888999',
        'level', 1,
        'comments', 'Primary beneficiary - youngest son'
      ),
      jsonb_build_object(
        'name', 'Grace Johnson',
        'relationship', 'Niece',
        'percentage', 50,
        'passport_number', 'GB000111222',
        'level', 2,
        'comments', 'Contingent beneficiary if primary beneficiaries are unable to inherit'
      ),
      jsonb_build_object(
        'name', 'Oliver Brown',
        'relationship', 'Nephew',
        'percentage', 50,
        'passport_number', 'GB333444555',
        'level', 2,
        'comments', 'Contingent beneficiary'
      )
    ),
    'assets', jsonb_build_array(
      jsonb_build_object(
        'category', 'property',
        'description', 'Family home - 3 bedroom house with garden',
        'location', 'London, UK',
        'estimated_value', 750000
      ),
      jsonb_build_object(
        'category', 'property',
        'description', 'Holiday cottage in Cornwall',
        'location', 'Cornwall, UK',
        'estimated_value', 350000
      ),
      jsonb_build_object(
        'category', 'financial',
        'description', 'Barclays Bank Savings Account - Main savings',
        'location', 'UK',
        'estimated_value', 125000
      ),
      jsonb_build_object(
        'category', 'financial',
        'description', 'Investment Portfolio - Stocks and Bonds',
        'location', 'UK',
        'estimated_value', 200000
      ),
      jsonb_build_object(
        'category', 'financial',
        'description', 'Pension Fund - Company pension',
        'location', 'UK',
        'estimated_value', 450000
      ),
      jsonb_build_object(
        'category', 'other',
        'description', 'Jewelry collection including wedding rings and family heirlooms',
        'location', 'Home safe',
        'estimated_value', 25000
      ),
      jsonb_build_object(
        'category', 'other',
        'description', 'Antique furniture collection',
        'location', 'Family home',
        'estimated_value', 15000
      ),
      jsonb_build_object(
        'category', 'other',
        'description', 'Art collection - Various paintings and sculptures',
        'location', 'Family home',
        'estimated_value', 35000
      )
    ),
    'special_requests', jsonb_build_object(
      'funeral_wishes', 'I wish to be buried according to Islamic traditions at the local Muslim cemetery. I would like a simple ceremony with close family and friends. Please ensure all funeral rites are performed according to Islamic law.',
      'guardianship', 'In the event that both myself and my spouse pass away before our children reach the age of 18, I appoint my brother David Smith and his wife as guardians of our children. They have agreed to this responsibility and understand the importance of raising our children with our values.',
      'digital_assets', 'I grant my executor access to all my digital accounts including email, social media, cloud storage, and cryptocurrency wallets. All passwords are stored in a secure password manager (details with my solicitor). My digital photo library should be preserved and shared with my children.',
      'other', 'My vintage car collection should be kept together if possible and offered to my son Michael first. If he does not wish to keep them, they should be sold and proceeds distributed among the beneficiaries. My library of rare books should be offered to the British Library or a suitable institution.'
    ),
    'disinherit', jsonb_build_array(
      jsonb_build_object(
        'name', 'Richard Smith',
        'relationship', 'Cousin',
        'reason', 'Due to ongoing family disputes and estrangement over the past 15 years, I explicitly exclude Richard Smith from any inheritance or benefit from my estate.'
      )
    ),
    'receipt_acknowledgement', TRUE,
    'receipt_acknowledgement_at', NOW() - INTERVAL '5 days'
  ),
  jsonb_build_array(
    jsonb_build_object(
      'mime', 'image/jpeg',
      'name', 'passport-main.jpg',
      'path', 'wills/3260e7ae-3d2a-4b2a-a21b-04d76f301010/passport-1760616127700.jpg',
      'size', 245680,
      'type', 'passport',
      'uploaded_at', NOW() - INTERVAL '5 days'
    ),
    jsonb_build_object(
      'mime', 'image/jpeg',
      'name', 'emirates-id-front.jpg',
      'path', 'wills/3260e7ae-3d2a-4b2a-a21b-04d76f301010/emirates_id-1760616127701.jpg',
      'size', 198432,
      'type', 'emirates_id',
      'uploaded_at', NOW() - INTERVAL '5 days'
    ),
    jsonb_build_object(
      'mime', 'image/jpeg',
      'name', 'emirates-id-back.jpg',
      'path', 'wills/3260e7ae-3d2a-4b2a-a21b-04d76f301010/emirates_id-1760616127702.jpg',
      'size', 201567,
      'type', 'emirates_id',
      'uploaded_at', NOW() - INTERVAL '5 days'
    ),
    jsonb_build_object(
      'mime', 'application/pdf',
      'name', 'property-deed-london.pdf',
      'path', 'wills/3260e7ae-3d2a-4b2a-a21b-04d76f301010/document-1760616127703.pdf',
      'size', 456789,
      'type', 'document',
      'uploaded_at', NOW() - INTERVAL '5 days'
    ),
    jsonb_build_object(
      'mime', 'image/jpeg',
      'name', 'poa-document.jpg',
      'path', 'wills/3260e7ae-3d2a-4b2a-a21b-04d76f301010/poa-1760616127705.jpg',
      'size', 112725,
      'type', 'poa',
      'uploaded_at', NOW() - INTERVAL '5 days'
    ),
    jsonb_build_object(
      'mime', 'application/pdf',
      'name', 'bank-statements.pdf',
      'path', 'wills/3260e7ae-3d2a-4b2a-a21b-04d76f301010/document-1760616127706.pdf',
      'size', 678901,
      'type', 'document',
      'uploaded_at', NOW() - INTERVAL '5 days'
    )
  ),
  NOW() - INTERVAL '6 days',
  NOW() - INTERVAL '1 day'
);

-- Optional: Insert some status history events
INSERT INTO public.will_status_events (
  will_id,
  previous_status,
  new_status,
  actor_user_id,
  notes,
  created_at
)
SELECT
  w.id,
  'in_progress',
  'awaiting_review',
  '3260e7ae-3d2a-4b2a-a21b-04d76f301010',
  'Client completed the will form',
  NOW() - INTERVAL '5 days'
FROM public.wills w
WHERE w.user_id = '3260e7ae-3d2a-4b2a-a21b-04d76f301010'
ORDER BY w.created_at DESC
LIMIT 1;

INSERT INTO public.will_status_events (
  will_id,
  previous_status,
  new_status,
  actor_user_id,
  notes,
  created_at
)
SELECT
  w.id,
  'awaiting_review',
  'under_review',
  '3260e7ae-3d2a-4b2a-a21b-04d76f301010',
  'Admin started reviewing the submission',
  NOW() - INTERVAL '4 days'
FROM public.wills w
WHERE w.user_id = '3260e7ae-3d2a-4b2a-a21b-04d76f301010'
ORDER BY w.created_at DESC
LIMIT 1;

INSERT INTO public.will_status_events (
  will_id,
  previous_status,
  new_status,
  actor_user_id,
  notes,
  created_at
)
SELECT
  w.id,
  'under_review',
  'draft_ready',
  '3260e7ae-3d2a-4b2a-a21b-04d76f301010',
  'Draft completed and ready for release',
  NOW() - INTERVAL '2 days'
FROM public.wills w
WHERE w.user_id = '3260e7ae-3d2a-4b2a-a21b-04d76f301010'
ORDER BY w.created_at DESC
LIMIT 1;

INSERT INTO public.will_status_events (
  will_id,
  previous_status,
  new_status,
  actor_user_id,
  notes,
  created_at
)
SELECT
  w.id,
  'draft_ready',
  'draft_released',
  '3260e7ae-3d2a-4b2a-a21b-04d76f301010',
  'Draft PDF released to client for review',
  NOW() - INTERVAL '2 days'
FROM public.wills w
WHERE w.user_id = '3260e7ae-3d2a-4b2a-a21b-04d76f301010'
ORDER BY w.created_at DESC
LIMIT 1;

-- Display the inserted will
SELECT
  id,
  user_id,
  status,
  client_approval_status,
  client_approval_comments,
  created_at
FROM public.wills
WHERE user_id = '3260e7ae-3d2a-4b2a-a21b-04d76f301010'
ORDER BY created_at DESC
LIMIT 1;
