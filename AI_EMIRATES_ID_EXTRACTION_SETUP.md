# AI-Based Emirates ID Extraction Setup Guide

This guide explains how to set up and use the AI-powered Emirates ID extraction feature that extracts both Arabic names and Emirates ID numbers.

## ✨ Features

- **AI-Powered Extraction**: Uses OpenAI GPT-4 Vision for intelligent document analysis
- **Arabic Name Support**: Successfully extracts Arabic names (الاسم العربي) from Emirates IDs
- **English Name Support**: Extracts English names as well
- **Dual Storage**: Stores both Arabic and English names separately in the database
- **Smart Fallback**: Automatically falls back to traditional OCR if AI extraction fails
- **Works on Both Sides**:
  - ✅ Client Portal (user uploads)
  - ✅ Admin Portal (document management)

---

## 🚀 Setup Instructions

### Step 1: Get OpenAI API Key

1. Go to: https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the API key (starts with `sk-proj-...` or `sk-...`)
5. **IMPORTANT**: Save it securely - you won't be able to see it again!

### Step 2: Add API Key to Environment Variables

1. Open your `.env` file in the project root
2. Find the line: `VITE_OPENAI_API_KEY="your-openai-api-key-here"`
3. Replace `your-openai-api-key-here` with your actual API key:
   \`\`\`
   VITE_OPENAI_API_KEY="sk-proj-YOUR_ACTUAL_KEY_HERE"
   \`\`\`
4. Save the file

### Step 3: Deploy Database Migration

Run the following command to add the new database columns:

\`\`\`bash
# If using Supabase CLI locally
supabase db push

# OR apply the migration manually in Supabase Dashboard:
# Go to SQL Editor and run:
\`\`\`

\`\`\`sql
-- Add arabic_name and english_name columns
ALTER TABLE public.user_identity_documents
ADD COLUMN IF NOT EXISTS arabic_name TEXT,
ADD COLUMN IF NOT EXISTS english_name TEXT;

COMMENT ON COLUMN public.user_identity_documents.arabic_name IS 'Arabic name extracted from Emirates ID via AI (الاسم العربي)';
COMMENT ON COLUMN public.user_identity_documents.english_name IS 'English name extracted from Emirates ID via AI';
\`\`\`

### Step 4: Restart Your Development Server

\`\`\`bash
# Stop the server (Ctrl+C) if running, then:
npm run dev
\`\`\`

### Step 5: (Optional) Add to Vercel Environment Variables

If you're deploying to Vercel:

1. Go to: Vercel Dashboard > Your Project > Settings > Environment Variables
2. Add a new variable:
   - **Name**: `VITE_OPENAI_API_KEY`
   - **Value**: Your OpenAI API key
   - **Environment**: Select all (Production, Preview, Development)
3. Click "Save"
4. Redeploy your application

---

## 📖 How It Works

### Extraction Process

1. **User uploads Emirates ID** (either front or back)
2. **AI Analysis**: The system sends the image to OpenAI GPT-4 Vision
3. **GPT-4 extracts**:
   - Emirates ID Number (784-YYYY-XXXXXXX-X format)
   - Arabic Name (الاسم العربي)
   - English Name
4. **Fallback**: If AI fails, traditional OCR (Tesseract) is used
5. **Storage**: Data is saved to `user_identity_documents` table:
   - `emirates_id_number`: The 15-digit ID
   - `extracted_name`: Primary name (Arabic preferred)
   - `arabic_name`: Arabic name specifically
   - `english_name`: English name specifically

### Toast Notifications

The system shows which method was used:
- **"🤖 AI"** - Extracted using AI (most accurate)
- **"📝 OCR"** - Extracted using traditional OCR (fallback)

---

## 💰 Cost Information

### OpenAI Pricing (as of 2024)

**GPT-4o-mini (model used for extraction)**:
- Input: $0.150 / 1M tokens (~$0.0015 per 10 images)
- Output: $0.600 / 1M tokens (~$0.006 per 10 images)

**Estimated cost per Emirates ID extraction**: ~$0.001 - $0.002 (less than 1 cent)

### Free Tier

OpenAI provides:
- **$5 free credits** for new accounts
- This allows approximately **2,500 - 5,000 free extractions**

---

## 🧪 Testing

### How to Test

1. **Client Portal**:
   - Log in as a client
   - Go to Identity Upload step
   - Upload an Emirates ID image
   - Watch for the extraction toast message

2. **Admin Portal**:
   - Log in as admin
   - Go to User Management
   - Select a user and manage their documents
   - Upload an Emirates ID
   - Verify extraction results

### What to Verify

- ✅ Emirates ID number is extracted correctly
- ✅ Arabic name is extracted (if present on card)
- ✅ English name is extracted
- ✅ Toast shows "🤖 AI" indicator
- ✅ Data appears in user_identity_documents table

---

## 🔧 Troubleshooting

### Problem: AI extraction not working

**Solution**:
1. Check if API key is set correctly in `.env`
2. Restart development server
3. Check browser console for errors
4. Verify OpenAI account has credits: https://platform.openai.com/usage

### Problem: Only OCR extraction happening

**Possible causes**:
- API key not set or invalid
- OpenAI account out of credits
- Network connectivity issues

**Solution**:
- Check console logs for error messages
- System automatically falls back to OCR, so extractions still work
- Verify API key and credits

### Problem: Arabic names not extracted

**Solution**:
- Ensure image quality is good (clear, well-lit, not blurry)
- Make sure the full name is visible in the image
- AI should handle Arabic text better than OCR

---

## 📊 Monitoring Usage

### Check OpenAI Usage

1. Go to: https://platform.openai.com/usage
2. View your API usage and costs
3. Set up usage limits if needed

### Database Queries

\`\`\`sql
-- Check extracted names
SELECT
  user_id,
  emirates_id_number,
  extracted_name,
  arabic_name,
  english_name,
  created_at
FROM user_identity_documents
WHERE emirates_id_number IS NOT NULL
ORDER BY created_at DESC;

-- Count successful extractions
SELECT
  COUNT(*) as total_extractions,
  COUNT(arabic_name) as with_arabic,
  COUNT(english_name) as with_english
FROM user_identity_documents
WHERE emirates_id_number IS NOT NULL;
\`\`\`

---

## 🔒 Security Notes

- **Never commit `.env` file** to git (it's in `.gitignore`)
- **Never share API keys** publicly or in chat
- **Rotate API keys** periodically for security
- **Set usage limits** in OpenAI dashboard to prevent unexpected costs

---

## 📝 Code References

### Files Modified/Created

1. **New AI extraction utility**: `src/lib/ai-emirates-extraction.ts`
2. **Client-side component**: `src/components/will-form/StepIdentityUpload.tsx`
3. **Admin-side component**: `src/components/admin/UserDocumentManagementModal.tsx`
4. **Database migration**: `supabase/migrations/20251031000002_add_arabic_english_names_to_user_identity_documents.sql`
5. **Environment files**: `.env` and `.env.example`

### Key Functions

- `extractEmiratesIdWithAI(imageFile, ocrText?)` - Main AI extraction function
- `getDisplayName(result)` - Gets display name (prefers Arabic)
- `isExtractionSuccessful(result)` - Validates extraction success

---

## ✅ Success Checklist

Before deploying to production:

- [ ] OpenAI API key added to `.env`
- [ ] Database migration applied
- [ ] Tested on client portal
- [ ] Tested on admin portal
- [ ] Verified Arabic name extraction works
- [ ] Verified English name extraction works
- [ ] Checked OpenAI usage dashboard
- [ ] Set usage limits in OpenAI (optional but recommended)
- [ ] Added API key to Vercel environment variables (if deploying)

---

## 🎉 Benefits

✅ **Better Arabic Support**: AI understands Arabic text natively
✅ **Higher Accuracy**: GPT-4 Vision is more accurate than traditional OCR
✅ **Context-Aware**: AI understands document layout and structure
✅ **Dual Language**: Extracts both Arabic and English names
✅ **Automatic Fallback**: Still works if AI is unavailable
✅ **Low Cost**: ~$0.001 per extraction

---

## 📞 Support

If you encounter issues:

1. Check this documentation first
2. Review console logs for errors
3. Verify OpenAI dashboard for API status
4. Contact support with error logs and screenshots

---

**Last Updated**: October 31, 2025
**Version**: 1.0
