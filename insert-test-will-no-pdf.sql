-- SQL Script to insert a test will WITHOUT a PDF file
-- This will show in the client portal but won't have a downloadable PDF

-- STEP 1: Find an existing user
SELECT id, email FROM auth.users LIMIT 5;

-- STEP 2: Replace 'YOUR_USER_ID_HERE' with an actual user ID from Step 1

INSERT INTO public.wills (
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
  upload_files
)
VALUES (
  'YOUR_USER_ID_HERE'::uuid, -- REPLACE THIS
  'draft_released'::will_status,
  NOW() - INTERVAL '5 days',
  NULL, -- No PDF file - this is the key change
  NULL, -- No PDF generated time either
  TRUE,
  'disapproved',
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
        'category', 'financial',
        'description', 'Barclays Bank Savings Account',
        'location', 'UK',
        'estimated_value', 125000
      ),
      jsonb_build_object(
        'category', 'other',
        'description', 'Jewelry collection',
        'location', 'Home safe',
        'estimated_value', 25000
      )
    ),
    'special_requests', jsonb_build_object(
      'funeral_wishes', 'I wish to be buried according to Islamic traditions at the local Muslim cemetery.',
      'guardianship', 'I appoint my brother David Smith as guardian of my children.',
      'digital_assets', 'I grant my executor access to all my digital accounts.',
      'other', 'My vintage car collection should be kept together.'
    ),
    'disinherit', jsonb_build_array(
      jsonb_build_object(
        'name', 'Richard Smith',
        'relationship', 'Cousin',
        'reason', 'Due to ongoing family disputes and estrangement.'
      )
    ),
    'receipt_acknowledgement', TRUE,
    'receipt_acknowledgement_at', NOW() - INTERVAL '5 days'
  ),
  jsonb_build_array(
    jsonb_build_object(
      'mime', 'image/jpeg',
      'name', 'poa-document.jpg',
      'path', 'wills/3260e7ae-3d2a-4b2a-a21b-04d76f301010/poa-1760616127705.jpg',
      'size', 112725,
      'type', 'poa',
      'uploaded_at', NOW() - INTERVAL '5 days'
    )
  )
);

-- STEP 3: View the inserted record
SELECT id, user_id, status, client_approval_status, pdf_path, created_at
FROM public.wills
ORDER BY created_at DESC
LIMIT 1;
