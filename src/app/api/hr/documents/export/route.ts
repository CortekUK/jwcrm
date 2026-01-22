import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import {
  DocumentExportFilters,
  ExportableDocument,
  DocumentExportManifestRow,
} from "@/types/document-export";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  passport: "Passport",
  employment_visa: "Employment Visa",
  emirates_id: "Emirates ID",
  employment_contract: "Employment Contract",
};

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];

    // Create supabase client with service role for storage access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the token
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const { filters }: { filters: DocumentExportFilters } = body;

    if (!filters) {
      return NextResponse.json(
        { error: "Missing required field: filters" },
        { status: 400 }
      );
    }

    // Build query for documents with employee and department info
    let query = supabase
      .from("employee_documents")
      .select(
        `
        id,
        employee_id,
        document_type,
        document_path,
        document_name,
        document_mime,
        expiry_date,
        is_active,
        archived_at,
        uploaded_at,
        employees!inner (
          id,
          full_name,
          employment_status,
          department_id,
          departments (
            id,
            name
          )
        )
      `
      )
      .eq("employees.employment_status", "active");

    // Apply active/expired filter
    if (!filters.includeExpired) {
      query = query.eq("is_active", true);
    }

    // Apply department filter
    if (filters.departmentIds !== "all" && filters.departmentIds.length > 0) {
      query = query.in("employees.department_id", filters.departmentIds);
    }

    // Apply employee filter
    if (filters.employeeIds !== "all" && filters.employeeIds.length > 0) {
      query = query.in("employee_id", filters.employeeIds);
    }

    const { data: documents, error: docsError } = await query.order(
      "uploaded_at",
      { ascending: false }
    );

    if (docsError) {
      console.error("Error fetching documents:", docsError);
      return NextResponse.json(
        { error: "Failed to fetch documents" },
        { status: 500 }
      );
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json(
        { error: "No documents found matching the criteria" },
        { status: 404 }
      );
    }

    // Transform documents to exportable format
    const exportableDocs: ExportableDocument[] = documents.map((doc: any) => ({
      id: doc.id,
      employee_id: doc.employee_id,
      employee_name: doc.employees?.full_name || "Unknown",
      department_name: doc.employees?.departments?.name || "No Department",
      document_type: doc.document_type,
      document_path: doc.document_path,
      document_name: doc.document_name,
      document_mime: doc.document_mime,
      expiry_date: doc.expiry_date,
      is_active: doc.is_active,
      archived_at: doc.archived_at,
      uploaded_at: doc.uploaded_at,
    }));

    // Create ZIP file
    const zip = new JSZip();
    const manifestRows: DocumentExportManifestRow[] = [];
    const failedDownloads: string[] = [];

    // Download each document and add to ZIP
    for (const doc of exportableDocs) {
      try {
        // Generate signed URL for the document
        const { data: signedUrlData, error: signedUrlError } =
          await supabase.storage
            .from("wills")
            .createSignedUrl(doc.document_path, 300); // 5 minute expiry

        if (signedUrlError || !signedUrlData?.signedUrl) {
          console.error(
            `Failed to get signed URL for ${doc.document_path}:`,
            signedUrlError
          );
          failedDownloads.push(
            `${doc.employee_name}/${doc.document_type}: ${doc.document_name}`
          );
          continue;
        }

        // Download the file
        const response = await fetch(signedUrlData.signedUrl);
        if (!response.ok) {
          console.error(
            `Failed to download ${doc.document_path}: ${response.status}`
          );
          failedDownloads.push(
            `${doc.employee_name}/${doc.document_type}: ${doc.document_name}`
          );
          continue;
        }

        const fileBuffer = await response.arrayBuffer();

        // Sanitize names for file paths
        const safeDepartmentName = sanitizeFilename(doc.department_name || "No Department");
        const safeEmployeeName = sanitizeFilename(doc.employee_name);
        const safeDocumentName = sanitizeFilename(doc.document_name);

        // Determine file extension
        const extension = getFileExtension(doc.document_name, doc.document_mime);
        const documentTypeLabel = DOCUMENT_TYPE_LABELS[doc.document_type] || doc.document_type;

        // Create folder structure: department/employee/document
        const statusSuffix = doc.is_active ? "" : "_archived";
        const fileName = `${documentTypeLabel}${statusSuffix}.${extension}`;
        const zipPath = `${safeDepartmentName}/${safeEmployeeName}/${fileName}`;

        // Add file to ZIP
        zip.file(zipPath, fileBuffer);

        // Add to manifest
        manifestRows.push({
          employee_name: doc.employee_name,
          department: doc.department_name || "No Department",
          document_type: documentTypeLabel,
          document_name: doc.document_name,
          expiry_date: doc.expiry_date || "No Expiry",
          status: doc.is_active ? "Active" : "Archived",
          uploaded_at: doc.uploaded_at
            ? new Date(doc.uploaded_at).toLocaleDateString()
            : "Unknown",
          file_path_in_zip: zipPath,
        });
      } catch (error) {
        console.error(`Error processing document ${doc.id}:`, error);
        failedDownloads.push(
          `${doc.employee_name}/${doc.document_type}: ${doc.document_name}`
        );
      }
    }

    if (manifestRows.length === 0) {
      return NextResponse.json(
        { error: "Failed to download any documents" },
        { status: 500 }
      );
    }

    // Create manifest Excel file
    const manifestWorkbook = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ["Employee Documents Export"],
      [],
      ["Export Date", new Date().toLocaleDateString()],
      ["Export Time", new Date().toLocaleTimeString()],
      [],
      ["Export Options"],
      ["Include Archived Documents", filters.includeExpired ? "Yes" : "No"],
      [
        "Departments",
        filters.departmentIds === "all"
          ? "All Departments"
          : `${(filters.departmentIds as string[]).length} selected`,
      ],
      [
        "Employees",
        filters.employeeIds === "all"
          ? "All Employees"
          : `${(filters.employeeIds as string[]).length} selected`,
      ],
      [],
      ["Statistics"],
      ["Total Documents Exported", manifestRows.length.toString()],
      ["Failed Downloads", failedDownloads.length.toString()],
    ];

    if (failedDownloads.length > 0) {
      summaryData.push([]);
      summaryData.push(["Failed Downloads:"]);
      failedDownloads.forEach((f) => summaryData.push([f]));
    }

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet["!cols"] = [{ wch: 30 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(manifestWorkbook, summarySheet, "Summary");

    // Documents list sheet
    const documentsHeaders = [
      "Employee Name",
      "Department",
      "Document Type",
      "Original Filename",
      "Expiry Date",
      "Status",
      "Uploaded At",
      "Path in ZIP",
    ];

    const documentsData = [
      documentsHeaders,
      ...manifestRows.map((row) => [
        row.employee_name,
        row.department,
        row.document_type,
        row.document_name,
        row.expiry_date,
        row.status,
        row.uploaded_at,
        row.file_path_in_zip,
      ]),
    ];

    const documentsSheet = XLSX.utils.aoa_to_sheet(documentsData);
    documentsSheet["!cols"] = [
      { wch: 25 },
      { wch: 20 },
      { wch: 20 },
      { wch: 30 },
      { wch: 15 },
      { wch: 10 },
      { wch: 15 },
      { wch: 50 },
    ];
    XLSX.utils.book_append_sheet(manifestWorkbook, documentsSheet, "Documents");

    // Convert manifest to buffer and add to ZIP
    const manifestBuffer = XLSX.write(manifestWorkbook, {
      type: "array",
      bookType: "xlsx",
    });
    zip.file("manifest.xlsx", manifestBuffer);

    // Generate ZIP file
    const zipBuffer = await zip.generateAsync({
      type: "arraybuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    // Generate filename
    const dateStr = new Date().toISOString().split("T")[0];
    const exportType = filters.includeExpired ? "all_documents" : "active_documents";
    const filename = `employee_documents_${exportType}_${dateStr}.zip`;

    // Return the ZIP file
    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export documents" },
      { status: 500 }
    );
  }
}

// Helper function to sanitize filenames
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .trim();
}

// Helper function to get file extension
function getFileExtension(filename: string, mimeType: string | null): string {
  // Try to get from filename first
  const match = filename.match(/\.([a-zA-Z0-9]+)$/);
  if (match) {
    return match[1].toLowerCase();
  }

  // Fallback to mime type
  if (mimeType) {
    const mimeExtensions: Record<string, string> = {
      "application/pdf": "pdf",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
    };
    return mimeExtensions[mimeType] || "bin";
  }

  return "bin";
}
