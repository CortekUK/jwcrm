# Passport Number Extraction Function

This Supabase Edge Function uses **Tesseract.js** OCR to automatically extract passport numbers from uploaded passport images.

## Features

- ✅ **Zero Configuration**: No API keys required - works out of the box!
- ✅ **In-Memory Processing**: Runs completely in-memory using Tesseract.js
- ✅ **No External APIs**: No third-party API calls or rate limits
- ✅ **Multiple Format Support**: Handles various passport formats (UK, US, EU, etc.)
- ✅ **Pattern Matching**: Uses regex patterns to identify passport numbers
- ✅ **Database Integration**: Automatically saves extracted passport numbers
- ✅ **Fallback Support**: Manual input available if extraction fails
- ✅ **Free**: No costs for OCR processing

## Technology

Uses **Tesseract.js v5** - a pure JavaScript port of the Tesseract OCR engine that runs in Deno/Node.js without native dependencies.

## Setup

### 1. Deploy the Function

\`\`\`bash
supabase functions deploy extract-passport-number
\`\`\`

That's it! No API keys or environment variables needed.

### 2. Test the Function

\`\`\`bash
curl -X POST 'https://YOUR_PROJECT.supabase.co/functions/v1/extract-passport-number' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "file_path": "user_id/will_id/passport_filename.jpg",
    "will_id": "your-will-id"
  }'
\`\`\`

## How It Works

1. **Upload**: User uploads passport image through StepIdentityUpload component
2. **Trigger**: After successful upload, the function is called automatically
3. **OCR Processing**:
   - Creates a signed URL for the uploaded image
   - Initializes Tesseract.js worker
   - Processes image using OCR
   - Terminates worker to free memory
4. **Pattern Matching**: Uses regex patterns to identify passport number from extracted text
5. **Save**: Extracted passport number is saved to the will's answers in the database
6. **Display**: Number appears in the UI with "✓ Auto-detected" badge
7. **Verify**: User can verify and edit the number if needed

## Supported Passport Formats

The function recognizes multiple passport formats:

- **UK**: 9 digits (e.g., `123456789`)
- **US**: 9 alphanumeric (e.g., `123456789` or `C12345678`)
- **EU**: Various formats (6-9 alphanumeric)
- **MRZ Format**: Machine Readable Zone (e.g., `P<GBR123456789<<<`)
- **Generic**: 6-9 character alphanumeric combinations

### Pattern Examples

\`\`\`
PASSPORT NUMBER: A12345678  → Extracted: A12345678
P<GBRA12345678<<<           → Extracted: A12345678
NO. 123456789               → Extracted: 123456789
Document: C1234567          → Extracted: C1234567
\`\`\`

## Error Handling

If extraction fails:
- User receives a friendly toast notification
- Manual input field is shown
- No error blocks the form submission
- User can continue with manual entry

## Development

Test locally using Supabase CLI:

\`\`\`bash
supabase functions serve extract-passport-number
\`\`\`

Test with curl:

\`\`\`bash
curl -X POST 'http://localhost:54321/functions/v1/extract-passport-number' \
  -H 'Authorization: Bearer YOUR_LOCAL_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "file_path": "test/passport.jpg",
    "will_id": "test-will-id"
  }'
\`\`\`

## Security

- ✅ Function requires valid JWT authentication
- ✅ Only processes images from authenticated users
- ✅ Uses signed URLs with 10-minute expiration
- ✅ All processing happens in-memory (no data sent to third parties)
- ✅ No passport data stored or logged permanently

## Performance

- **First Run**: ~3-5 seconds (Tesseract initialization + OCR)
- **Confidence Score**: Logged for debugging
- **Memory**: Worker is terminated after each request
- **Concurrent Requests**: Each request gets its own worker

## Troubleshooting

### Passport number not detected

**Possible reasons:**
- Image quality too low (blurry, dark, or low resolution)
- Text not in English
- Unusual passport format
- Poor lighting or glare on photo

**Solutions:**
1. User can manually enter the number using the input field
2. Suggest user retake photo with better lighting
3. Ensure passport is flat and in focus

### Wrong number extracted

**Solution:** User can edit the number in the input field before submission. The auto-detected value is just a starting point.

### Function timeout

If processing takes too long:
- Check image file size (optimize images before upload)
- Consider implementing image preprocessing
- Ensure passport image is clear and high contrast

## Cost Considerations

### Tesseract.js (FREE!)
- ✅ Completely free
- ✅ No rate limits
- ✅ No API keys
- ✅ Runs in your Supabase Edge Function
- ⚠️ Uses compute time (counts against Supabase function limits)

### Paid Alternatives (if needed)

If you need higher accuracy or faster processing:

- **Google Cloud Vision**: $1.50 per 1000 images (high accuracy)
- **AWS Textract**: $1.50 per 1000 pages (specialized for documents)
- **Azure Computer Vision**: $1.00 per 1000 transactions

## Alternative OCR Providers

### Google Cloud Vision API

Replace the `extractTextFromImage` function with:

\`\`\`typescript
async function extractTextFromImage(imageUrl: string): Promise<string> {
  const { ImageAnnotatorClient } = await import('npm:@google-cloud/vision@4.3.2');
  const client = new ImageAnnotatorClient({
    credentials: JSON.parse(Deno.env.get('GOOGLE_CLOUD_CREDENTIALS') || '{}')
  });
  const [result] = await client.textDetection(imageUrl);
  return result.fullTextAnnotation?.text || '';
}
\`\`\`

### AWS Textract

\`\`\`typescript
async function extractTextFromImage(imageUrl: string): Promise<string> {
  const { TextractClient, DetectDocumentTextCommand } = await import('npm:@aws-sdk/client-textract');
  const client = new TextractClient({
    credentials: {
      accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID') || '',
      secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY') || '',
    },
    region: 'us-east-1',
  });

  const imageResponse = await fetch(imageUrl);
  const imageBuffer = await imageResponse.arrayBuffer();

  const command = new DetectDocumentTextCommand({
    Document: { Bytes: new Uint8Array(imageBuffer) }
  });

  const response = await client.send(command);
  return response.Blocks?.filter(b => b.BlockType === 'LINE')
    .map(b => b.Text).join('\n') || '';
}
\`\`\`

## Future Improvements

- [ ] Support for PDF passport scans
- [ ] Multi-language support (Arabic, Spanish, etc.)
- [ ] Passport expiry date extraction
- [ ] Document verification (confirm it's a passport)
- [ ] Confidence score display in UI
- [ ] Image preprocessing (rotation, contrast adjustment)
- [ ] Batch processing for multiple documents
- [ ] Support for national ID cards

## Logs and Debugging

The function logs the following for debugging:
- Tesseract initialization
- OCR progress
- Confidence score
- Extracted text (first 200 characters)
- Passport number found (or NOT FOUND)

Check logs in Supabase Dashboard > Edge Functions > Logs
