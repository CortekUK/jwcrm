# How to Add Watermark to PDF - Complete Guide

You have multiple options to add a watermark to your will PDFs.

---

## Option 1: PDFMonkey Template (Easiest) ⭐

Since you're using PDFMonkey, add the watermark directly in the template:

### Step 1: Login to PDFMonkey
1. Go to https://pdfmonkey.io
2. Login to your account
3. Find your will template

### Step 2: Add Watermark Layer
1. Click on your template
2. Go to **"Layers"** or **"Background"** section
3. Add a new layer for watermark

### Step 3: Add Watermark Text
In the template editor, add HTML/CSS:

```html
<!-- Add this to your template -->
<div class="watermark">DRAFT</div>
```

```css
/* Add this to your stylesheet */
.watermark {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-45deg);
  font-size: 120px;
  font-weight: bold;
  color: rgba(200, 200, 200, 0.3);
  z-index: 1000;
  pointer-events: none;
  user-select: none;
}

/* Make it appear on every page */
@media print {
  .watermark {
    display: block !important;
  }
}
```

### Step 4: Add to Every Page
For repeating watermark on every page:

```css
.watermark {
  position: fixed;
  /* Fixed position ensures it appears on every page */
}
```

### Step 5: Conditional Watermark (Optional)
Show watermark only for drafts:

```html
{{#if is_draft}}
  <div class="watermark">DRAFT</div>
{{/if}}
```

Then pass `is_draft: true` from your Edge Function:

```typescript
// In pdf-request/index.ts
const payload = {
  will_id: will.id,
  user_id: will.user_id,
  locale,
  answers: will.answers || {},
  uploads: will.upload_files || [],
  template_id: 'pdfmonkey_template_placeholder',
  is_draft: will.status !== 'finalized', // ← Add this
};
```

---

## Option 2: CSS Watermark in AdminWillPrint (Print View)

If you're generating PDFs from the browser print view:

### Update AdminWillPrint.tsx:

Add this CSS to your component or global styles:

```css
/* Add to your print styles */
@media print {
  .print-content::before {
    content: "DRAFT";
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
    font-size: 150px;
    font-weight: bold;
    color: rgba(200, 200, 200, 0.2);
    z-index: 1000;
    pointer-events: none;
  }
}
```

Or add a watermark div:

```tsx
// In AdminWillPrint.tsx
<div className="print-content">
  {/* Existing content */}

  {/* Add watermark */}
  <div className="watermark-print">DRAFT</div>
</div>
```

With CSS:

```css
.watermark-print {
  display: none;
}

@media print {
  .watermark-print {
    display: block;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
    font-size: 150px;
    font-weight: bold;
    color: rgba(200, 200, 200, 0.2);
    z-index: 9999;
    pointer-events: none;
    user-select: none;
  }
}
```

---

## Option 3: Server-Side Watermark (Most Robust)

Use a PDF library in your Edge Function or Make.com scenario:

### Using pdf-lib in Deno Edge Function:

Create a new function `pdf-watermark/index.ts`:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { PDFDocument, rgb, degrees } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdf_url, watermark_text = 'DRAFT' } = await req.json();

    // Fetch the PDF
    const pdfResponse = await fetch(pdf_url);
    const pdfBytes = await pdfResponse.arrayBuffer();

    // Load PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    // Add watermark to each page
    for (const page of pages) {
      const { width, height } = page.getSize();

      page.drawText(watermark_text, {
        x: width / 2 - 100,
        y: height / 2,
        size: 80,
        color: rgb(0.7, 0.7, 0.7),
        opacity: 0.3,
        rotate: degrees(-45),
      });
    }

    // Save PDF
    const watermarkedPdfBytes = await pdfDoc.save();

    return new Response(watermarkedPdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="watermarked.pdf"',
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
```

---

## Option 4: Make.com Watermark Module

In your Make.com scenario:

1. After PDFMonkey generates the PDF
2. Add a **"Tools" → "Watermark PDF"** module
3. Configure:
   - Source PDF: Output from PDFMonkey
   - Watermark text: "DRAFT"
   - Position: Center, 45° rotation
   - Opacity: 30%
   - Font size: 120

---

## Recommended Approach

**For your setup (PDFMonkey + Make.com):**

### Best Option: **PDFMonkey Template** (Option 1)

**Why?**
- ✅ No code changes needed
- ✅ Consistent across all PDFs
- ✅ Easy to customize
- ✅ Can be conditional (draft vs final)
- ✅ Works on every page automatically

### Steps:
1. Edit PDFMonkey template
2. Add watermark HTML/CSS (see Option 1)
3. Pass `is_draft` flag from Edge Function
4. Done!

---

## Watermark Styles

### 1. Diagonal "DRAFT"
```css
.watermark {
  transform: rotate(-45deg);
  font-size: 120px;
  color: rgba(200, 200, 200, 0.3);
}
```

### 2. "CONFIDENTIAL" Top-Right
```css
.watermark {
  position: fixed;
  top: 20px;
  right: 20px;
  font-size: 24px;
  color: rgba(255, 0, 0, 0.5);
  font-weight: bold;
}
```

### 3. Date Stamp
```css
.watermark {
  position: fixed;
  bottom: 20px;
  left: 20px;
  font-size: 10px;
  color: rgba(0, 0, 0, 0.5);
}
```

```html
<div class="watermark">
  Draft Generated: {{current_date}}
</div>
```

### 4. Image Watermark
```html
<img src="https://your-domain.com/draft-watermark.png"
     class="watermark-image"
     alt="Draft" />
```

```css
.watermark-image {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  opacity: 0.1;
  width: 400px;
  height: 400px;
}
```

---

## Testing

After adding watermark:

1. Generate a test PDF
2. Check every page has watermark
3. Verify opacity (should be visible but not obstructive)
4. Test final version (no watermark)

---

## Conditional Watermark Logic

Show watermark only for non-finalized wills:

### In PDFMonkey Template:
```html
{{#if status}}
  {{#unless (eq status 'finalized')}}
    <div class="watermark">DRAFT</div>
  {{/unless}}
{{/if}}
```

### Update pdf-request/index.ts:
```typescript
const payload = {
  will_id: will.id,
  user_id: will.user_id,
  locale,
  answers: will.answers || {},
  uploads: will.upload_files || [],
  template_id: 'pdfmonkey_template_placeholder',
  status: will.status, // ← Add this
  is_draft: will.status !== 'finalized', // ← Or this
};
```

---

## Quick Start (5 Minutes)

1. **Go to PDFMonkey template editor**
2. **Add this HTML at the top:**
   ```html
   <div class="watermark">DRAFT</div>
   ```
3. **Add this CSS:**
   ```css
   .watermark {
     position: fixed;
     top: 50%;
     left: 50%;
     transform: translate(-50%, -50%) rotate(-45deg);
     font-size: 120px;
     font-weight: bold;
     color: rgba(200, 200, 200, 0.3);
     z-index: 1000;
   }
   ```
4. **Save template**
5. **Test PDF generation**

Done! Every page will have a "DRAFT" watermark! 🎉

---

## Common Issues

### Watermark not appearing on all pages?
**Solution:** Use `position: fixed` instead of `position: absolute`

### Watermark too dark?
**Solution:** Reduce opacity: `rgba(200, 200, 200, 0.2)` (lower last number)

### Watermark not rotating?
**Solution:** Make sure you have: `transform: rotate(-45deg)`

### Watermark appears in wrong position?
**Solution:** Adjust `top`, `left`, and `transform: translate()` values

---

## Support

- **PDFMonkey Docs**: https://pdfmonkey.io/docs
- **Make.com PDF Tools**: https://www.make.com/en/integrations/pdf
- **CSS Print Styles**: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/print

---

**Recommendation**: Start with **Option 1 (PDFMonkey Template)** - it's the easiest and most reliable! 🚀
