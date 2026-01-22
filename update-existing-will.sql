-- Update an existing will record to fix the PDF path issue and add test data

-- STEP 1: Find the will you want to update
SELECT
  id,
  user_id,
  status,
  client_approval_status,
  pdf_path,
  created_at
FROM public.wills
ORDER BY created_at DESC
LIMIT 5;

-- STEP 2: Replace 'YOUR_WILL_ID_HERE' with the actual will ID from Step 1

UPDATE public.wills
SET
  status = 'draft_released'::will_status,
  submitted_at = NOW() - INTERVAL '5 days',
  pdf_path = NULL, -- Remove the PDF path since the file doesn't exist
  pdf_generated_at = NULL, -- Remove PDF generation time
  visible_to_client = TRUE,
  client_approval_status = 'disapproved',
  client_approval_at = NOW() - INTERVAL '1 day',
  client_approval_comments = 'I would like to change the distribution percentages for my beneficiaries. Also, please update the executor contact information for my brother.',
  answers = jsonb_build_object(
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
        'description', 'Barclays Bank Savings Account',
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
        'category', 'other',
        'description', 'Jewelry collection including wedding rings',
        'location', 'Home safe',
        'estimated_value', 25000
      ),
      jsonb_build_object(
        'category', 'other',
        'description', 'Art collection - Various paintings',
        'location', 'Family home',
        'estimated_value', 35000
      )
    ),
    'special_requests', jsonb_build_object(
      'funeral_wishes', 'I wish to be buried according to Islamic traditions at the local Muslim cemetery. I would like a simple ceremony with close family and friends.',
      'guardianship', 'In the event that both myself and my spouse pass away before our children reach the age of 18, I appoint my brother David Smith and his wife as guardians of our children.',
      'digital_assets', 'I grant my executor access to all my digital accounts including email, social media, cloud storage, and cryptocurrency wallets.',
      'other', 'My vintage car collection should be kept together if possible and offered to my son Michael first. If he does not wish to keep them, they should be sold and proceeds distributed among the beneficiaries.'
    ),
    'disinherit', jsonb_build_array(
      jsonb_build_object(
        'name', 'Richard Smith',
        'relationship', 'Cousin',
        'reason', 'Due to ongoing family disputes and estrangement over the past 15 years, I explicitly exclude Richard Smith from any inheritance.'
      )
    ),
    'receipt_acknowledgement', TRUE,
    'receipt_acknowledgement_at', NOW() - INTERVAL '5 days'
  ),
  upload_files = jsonb_build_array(
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
      'name', 'poa-document.jpg',
      'path', 'wills/3260e7ae-3d2a-4b2a-a21b-04d76f301010/poa-1760616127705.jpg',
      'size', 112725,
      'type', 'poa',
      'uploaded_at', NOW() - INTERVAL '5 days'
    )
  ),
  updated_at = NOW()
WHERE id = 'YOUR_WILL_ID_HERE'::uuid; -- REPLACE THIS WITH ACTUAL WILL ID

-- STEP 3: Verify the update
SELECT
  id,
  user_id,
  status,
  client_approval_status,
  LEFT(client_approval_comments, 50) as comments_preview,
  pdf_path,
  visible_to_client,
  updated_at
FROM public.wills
WHERE id = 'YOUR_WILL_ID_HERE'::uuid; -- REPLACE THIS WITH ACTUAL WILL ID
