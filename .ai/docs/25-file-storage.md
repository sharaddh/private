# 25 — File Storage

## Purpose

The KMJ Optical ERP system handles various file types: PDF invoices, QR codes, customer photos, product images, and document scans. File storage must be organized, secure, and branch-aware. Files must not bloat the git repository, must be served efficiently, and must be backed up separately from code. Poor file storage leads to disk space issues, broken links, security vulnerabilities, and deployment headaches.

## Core Principles

### 1. Files Outside Source Control

Never commit user-uploaded files or generated documents to git. Store them in a dedicated uploads directory that is excluded from version control. The `.gitignore` must exclude:

```
uploads/
*.pdf
*.png
*.jpg
*.jpeg
*.gif
!client/public/favicon.ico
```

### 2. Branch-Isolated Storage

Every file is organized by branch. Branch A's files are never mixed with Branch B's files. This ensures clean data isolation and makes per-branch backup/deletion possible.

```
uploads/
  {branchId}/
    invoices/
      INV-2024-0001.pdf
      INV-2024-0002.pdf
    customers/
      {customerId}/
        photo.jpg
    qr-codes/
      order-{orderId}.png
    documents/
      prescription-{customerId}.pdf
```

### 3. Deterministic File Paths

File paths must be computed from business data, not random. Given an order ID, you can always find its invoice PDF without querying the database.

### 4. Cleanup on Deletion

When a database record is deleted, its associated files must be cleaned up. Orphaned files waste disk space and can leak information.

## Detailed Rules

### Directory Structure

```
server/
  uploads/                          # Root upload directory (git-ignored)
    {branchId}/
      invoices/                     # Generated PDF invoices
      customers/
        {customerId}/              # Customer-specific files
          photo.jpg
          prescription.pdf
      orders/
        {orderId}/                 # Order-specific files
          invoice.pdf
          receipt.pdf
      qr-codes/                    # Generated QR code images
      documents/                   # Scanned documents, prescriptions
  src/
    utils/
      fileStorage.ts               # File storage utility
      pdf.ts                       # PDF generation
      qrCode.ts                    # QR code generation
```

### File Storage Utility

```typescript
// server/src/utils/fileStorage.ts
import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { logger } from './logger';
import { getActiveBranchId } from '../middleware/branch';

const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

interface FileStorageOptions {
  branchId?: string;
  subdirectory: string;
  fileName: string;
  contentType?: string;
}

class FileStorage {
  private rootDir: string;

  constructor(rootDir: string = UPLOADS_ROOT) {
    this.rootDir = rootDir;
  }

  // ── Path Building ──

  /**
   * Build the full file path for a branch-scoped file.
   * Structure: uploads/{branchId}/{subdirectory}/{fileName}
   */
  buildPath(options: FileStorageOptions): string {
    const branchId = options.branchId || getActiveBranchId();
    if (!branchId) {
      throw new Error('Branch ID required for file storage');
    }

    return path.join(
      this.rootDir,
      branchId,
      options.subdirectory,
      options.fileName
    );
  }

  /**
   * Build a relative URL path for serving files.
   * Returns: /uploads/{branchId}/{subdirectory}/{fileName}
   */
  buildUrl(options: FileStorageOptions): string {
    const branchId = options.branchId || getActiveBranchId();
    return `/uploads/${branchId}/${options.subdirectory}/${options.fileName}`;
  }

  // ── Ensure Directory Exists ──

  async ensureDir(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
      logger.info('Created upload directory', { dir });
    }
  }

  // ── Write File ──

  /**
   * Save a Buffer to disk.
   */
  async saveBuffer(
    buffer: Buffer,
    options: FileStorageOptions
  ): Promise<string> {
    const filePath = this.buildPath(options);
    await this.ensureDir(filePath);

    await fs.writeFile(filePath, buffer);

    logger.info('File saved', {
      path: filePath,
      size: buffer.length,
      branchId: options.branchId
    });

    return this.buildUrl(options);
  }

  /**
   * Save a stream to disk.
   */
  async saveStream(
    stream: Readable,
    options: FileStorageOptions
  ): Promise<string> {
    const filePath = this.buildPath(options);
    await this.ensureDir(filePath);

    const writeStream = createWriteStream(filePath);
    await pipeline(stream, writeStream);

    const stats = await fs.stat(filePath);
    logger.info('File saved via stream', {
      path: filePath,
      size: stats.size,
      branchId: options.branchId
    });

    return this.buildUrl(options);
  }

  // ── Read File ──

  async readFile(filePath: string): Promise<Buffer> {
    return fs.readFile(filePath);
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // ── Delete File ──

  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.info('File deleted', { path: filePath });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn('File deletion failed', {
          path: filePath,
          error: (error as Error).message
        });
      }
    }
  }

  /**
   * Delete all files in a directory.
   */
  async deleteDirectory(dirPath: string): Promise<void> {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
      logger.info('Directory deleted', { path: dirPath });
    } catch (error) {
      logger.warn('Directory deletion failed', {
        path: dirPath,
        error: (error as Error).message
      });
    }
  }

  // ── File Info ──

  async getFileInfo(filePath: string): Promise<{
    exists: boolean;
    size?: number;
    modified?: Date;
  }> {
    try {
      const stats = await fs.stat(filePath);
      return {
        exists: true,
        size: stats.size,
        modified: stats.mtime
      };
    } catch {
      return { exists: false };
    }
  }

  /**
   * Get total disk usage for a branch.
   */
  async getBranchUsage(branchId: string): Promise<{
    totalFiles: number;
    totalSize: number;
    byType: Record<string, { count: number; size: number }>;
  }> {
    const branchDir = path.join(this.rootDir, branchId);
    let totalFiles = 0;
    let totalSize = 0;
    const byType: Record<string, { count: number; size: number }> = {};

    try {
      await this.walkDir(branchDir, async (filePath, stats) => {
        totalFiles++;
        totalSize += stats.size;

        const ext = path.extname(filePath).toLowerCase();
        if (!byType[ext]) {
          byType[ext] = { count: 0, size: 0 };
        }
        byType[ext].count++;
        byType[ext].size += stats.size;
      });
    } catch {
      // Branch directory may not exist yet
    }

    return { totalFiles, totalSize, byType };
  }

  private async walkDir(
    dir: string,
    callback: (filePath: string, stats: Awaited<ReturnType<typeof fs.stat>>) => Promise<void>
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await this.walkDir(fullPath, callback);
        } else {
          const stats = await fs.stat(fullPath);
          await callback(fullPath, stats);
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }
}

export const fileStorage = new FileStorage();
```

### PDF Invoice Generation

```typescript
// server/src/utils/pdf.ts
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { fileStorage } from './fileStorage';
import { logger } from './logger';

interface InvoiceData {
  invoiceNumber: string;
  date: Date;
  customer: {
    name: string;
    phone: string;
    address?: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  totalAmount: number;
  paymentMethod?: string;
  notes?: string;
  branch: {
    name: string;
    address: string;
    phone: string;
  };
}

export async function generateInvoicePDF(
  data: InvoiceData,
  orderId: string,
  branchId: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Invoice ${data.invoiceNumber}`,
        Author: data.branch.name,
        Subject: 'Invoice'
      }
    });

    const stream = new PassThrough();
    doc.pipe(stream);

    // ── Header ──
    doc.fontSize(20).font('Helvetica-Bold').text(data.branch.name, { align: 'center' });
    doc.fontSize(10).font('Helvetica')
      .text(data.branch.address, { align: 'center' })
      .text(`Phone: ${data.branch.phone}`, { align: 'center' })
      .moveDown();

    // ── Invoice Info ──
    doc.fontSize(16).font('Helvetica-Bold').text('INVOICE');
    doc.fontSize(10).font('Helvetica')
      .text(`Invoice #: ${data.invoiceNumber}`)
      .text(`Date: ${data.date.toLocaleDateString('en-IN')}`)
      .moveDown();

    // ── Customer Info ──
    doc.fontSize(12).font('Helvetica-Bold').text('Bill To:');
    doc.fontSize(10).font('Helvetica')
      .text(data.customer.name)
      .text(`Phone: ${data.customer.phone}`);
    if (data.customer.address) {
      doc.text(data.customer.address);
    }
    doc.moveDown();

    // ── Items Table ──
    const tableTop = doc.y;
    const colWidths = { desc: 250, qty: 60, price: 90, total: 90 };

    // Table header
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Description', 50, tableTop, { width: colWidths.desc });
    doc.text('Qty', 300, tableTop, { width: colWidths.qty, align: 'right' });
    doc.text('Unit Price', 360, tableTop, { width: colWidths.price, align: 'right' });
    doc.text('Total', 460, tableTop, { width: colWidths.total, align: 'right' });

    // Header underline
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    // Table rows
    let y = tableTop + 25;
    doc.font('Helvetica').fontSize(10);

    for (const item of data.items) {
      doc.text(item.description, 50, y, { width: colWidths.desc });
      doc.text(item.quantity.toString(), 300, y, { width: colWidths.qty, align: 'right' });
      doc.text(formatCurrency(item.unitPrice), 360, y, { width: colWidths.price, align: 'right' });
      doc.text(formatCurrency(item.total), 460, y, { width: colWidths.total, align: 'right' });
      y += 20;
    }

    // Total line
    doc.moveTo(50, y).lineTo(550, y).stroke();
    y += 10;
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('Total:', 360, y, { width: colWidths.price, align: 'right' });
    doc.text(formatCurrency(data.totalAmount), 460, y, { width: colWidths.total, align: 'right' });

    // ── Payment Info ──
    if (data.paymentMethod) {
      y += 30;
      doc.fontSize(10).font('Helvetica')
        .text(`Payment Method: ${data.paymentMethod}`, 50, y);
    }

    // ── Notes ──
    if (data.notes) {
      y += 25;
      doc.fontSize(10).font('Helvetica-Bold').text('Notes:', 50, y);
      y += 15;
      doc.font('Helvetica').text(data.notes, 50, y, { width: 500 });
    }

    // ── Footer ──
    doc.fontSize(8).font('Helvetica')
      .text('Thank you for your business!', 50, 750, { align: 'center', width: 500 });

    doc.end();

    // Save to file
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        const url = await fileStorage.saveBuffer(buffer, {
          branchId,
          subdirectory: `orders/${orderId}`,
          fileName: `${data.invoiceNumber}.pdf`
        });
        resolve(url);
      } catch (error) {
        reject(error);
      }
    });
    stream.on('error', reject);
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(amount);
}
```

### QR Code Generation

```typescript
// server/src/utils/qrCode.ts
import QRCode from 'qrcode';
import { fileStorage } from './fileStorage';
import { logger } from './logger';

interface QROptions {
  data: string;           // URL or text to encode
  branchId: string;
  fileName: string;       // Without extension
  width?: number;
  margin?: number;
}

export async function generateQRCode(options: QROptions): Promise<string> {
  const {
    data,
    branchId,
    fileName,
    width = 300,
    margin = 2
  } = options;

  try {
    const buffer = await QRCode.toBuffer(data, {
      type: 'png',
      width,
      margin,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });

    const url = await fileStorage.saveBuffer(buffer, {
      branchId,
      subdirectory: 'qr-codes',
      fileName: `${fileName}.png`
    });

    logger.info('QR code generated', {
      data: data.substring(0, 50),
      branchId,
      fileName
    });

    return url;
  } catch (error) {
    logger.error('QR code generation failed', {
      error: (error as Error).message,
      data
    });
    throw error;
  }
}

/**
 * Generate QR code for order payment link.
 */
export async function generateOrderQR(
  orderId: string,
  orderNumber: string,
  amount: number,
  branchId: string
): Promise<string> {
  const paymentUrl = `${process.env.BASE_URL}/pay/${orderId}`;
  return generateQRCode({
    data: paymentUrl,
    branchId,
    fileName: `order-${orderNumber}`,
    width: 400
  });
}

/**
 * Generate QR code for business card / contact info.
 */
export async function generateContactQR(
  contactData: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
  },
  branchId: string
): Promise<string> {
  const vCard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${contactData.name}`,
    `TEL:${contactData.phone}`,
    contactData.email ? `EMAIL:${contactData.email}` : '',
    contactData.address ? `ADR:;;${contactData.address};;;` : '',
    'END:VCARD'
  ].filter(Boolean).join('\n');

  return generateQRCode({
    data: vCard,
    branchId,
    fileName: `contact-${contactData.phone}`,
    width: 300
  });
}
```

### Static File Serving

```typescript
// server/src/index.ts
import express from 'express';
import path from 'path';

const app = express();

// ── Serve uploaded files ──
// Static files are served with appropriate headers
app.use('/uploads', express.static(
  path.resolve(__dirname, '../uploads'),
  {
    // Cache static files for 1 hour
    maxAge: '1h',
    // Allow CORS for frontend
    setHeaders: (res, filePath) => {
      // Set content type for PDFs
      if (filePath.endsWith('.pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
      }
      // Prevent indexing
      res.setHeader('X-Robots-Tag', 'noindex');
    }
  }
));

// ── Serve frontend build ──
app.use(express.static(
  path.resolve(__dirname, '../../client/build'),
  {
    maxAge: '1d',
    index: false // Don't serve index.html for directories
  }
));
```

### File Upload Handling (Multer)

```typescript
// server/src/middleware/upload.ts
import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import { fileStorage } from '../utils/fileStorage';
import { getActiveBranchId } from './branch';
import { ApiError } from '../utils/errors';

// Allowed file types
const ALLOWED_TYPES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf']
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Custom storage engine that uses our fileStorage utility
const storage = multer.memoryStorage();

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedExts = Object.values(ALLOWED_TYPES).flat();
  const ext = path.extname(file.originalname).toLowerCase();

  if (!allowedExts.includes(ext)) {
    cb(new ApiError(
      `File type ${file.mimetype} is not allowed. Accepted: ${allowedExts.join(', ')}`,
      400,
      'INVALID_FILE_TYPE'
    ));
    return;
  }

  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5 // Max 5 files per request
  }
});

// ── Middleware to process uploaded files ──

export function processUpload(subdirectory: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file && !req.files) {
      return next();
    }

    const branchId = getActiveBranchId();
    if (!branchId) {
      throw new ApiError('Branch context required for file upload', 400, 'NO_BRANCH');
    }

    const files = req.files
      ? (req.files as Express.Multer.File[])
      : req.file
        ? [req.file]
        : [];

    const uploadedUrls: string[] = [];

    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;

      const url = await fileStorage.saveBuffer(file.buffer, {
        branchId,
        subdirectory,
        fileName: uniqueName
      });

      uploadedUrls.push(url);
    }

    // Attach URLs to request for controller use
    (req as any).uploadedFiles = uploadedUrls;
    next();
  };
}
```

### Customer Photo Upload

```typescript
// server/src/routes/customers.ts
import { upload, processUpload } from '../middleware/upload';

router.post('/:id/photo',
  authenticate,
  requireBranchAccess,
  upload.single('photo'),
  processUpload('customers'),
  async (req, res) => {
    const branchId = getActiveBranchId();
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, branch: branchId },
      { photo: (req as any).uploadedFiles[0] },
      { new: true }
    );

    if (!customer) {
      throw new ApiError('Customer not found', 404, 'NOT_FOUND');
    }

    res.json(successResponse(customer));
  }
);
```

### File Cleanup on Record Deletion

```typescript
// server/src/controllers/customerController.ts
export const customerController = {
  async delete(req: Request, res: Response) {
    const branchId = getActiveBranchId();
    const customer = await Customer.findOneAndDelete({
      _id: req.params.id,
      branch: branchId
    });

    if (!customer) {
      throw new ApiError('Customer not found', 404, 'NOT_FOUND');
    }

    // Clean up customer files
    if (customer.photo) {
      const photoPath = path.join(
        __dirname, '../../uploads',
        branchId,
        'customers',
        path.basename(customer.photo)
      );
      await fileStorage.deleteFile(photoPath);
    }

    // Delete customer directory
    const customerDir = path.join(
      __dirname, '../../uploads',
      branchId,
      'customers',
      customer._id.toString()
    );
    await fileStorage.deleteDirectory(customerDir);

    res.json(successResponse({ message: 'Customer deleted' }));
  }
};
```

### File Validation Middleware

```typescript
// server/src/middleware/fileValidation.ts
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';

interface ValidationRules {
  maxSize?: number;        // bytes
  allowedTypes?: string[]; // MIME types
  minWidth?: number;       // pixels (images only)
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export function validateFile(rules: ValidationRules) {
  return (req: Request, res: Response, next: NextFunction) => {
    const files = req.files
      ? (req.files as Express.Multer.File[])
      : req.file
        ? [req.file]
        : [];

    if (files.length === 0) {
      return next();
    }

    for (const file of files) {
      // Check file size
      if (rules.maxSize && file.size > rules.maxSize) {
        throw new ApiError(
          `File "${file.originalname}" exceeds maximum size of ${rules.maxSize / 1024 / 1024}MB`,
          400,
          'FILE_TOO_LARGE'
        );
      }

      // Check MIME type
      if (rules.allowedTypes && !rules.allowedTypes.includes(file.mimetype)) {
        throw new ApiError(
          `File type "${file.mimetype}" is not allowed`,
          400,
          'INVALID_FILE_TYPE'
        );
      }

      // Image dimension validation would go here
      // Using sharp or image-size library
    }

    next();
  };
}
```

### Disk Space Monitoring

```typescript
// server/src/utils/diskMonitor.ts
import fs from 'fs/promises';
import { logger } from './logger';

const DISK_USAGE_THRESHOLD = 0.85; // 85% usage warning

export async function checkDiskUsage(): Promise<{
  total: number;
  used: number;
  available: number;
  usagePercent: number;
  warning: boolean;
}> {
  try {
    const stats = await fs.statfs('uploads');
    const total = stats.blocks * stats.blksize;
    const available = stats.bfree * stats.blksize;
    const used = total - available;
    const usagePercent = used / total;

    if (usagePercent > DISK_USAGE_THRESHOLD) {
      logger.warn('Disk usage high', {
        usagePercent: (usagePercent * 100).toFixed(1),
        availableGB: (available / 1024 / 1024 / 1024).toFixed(2)
      });
    }

    return {
      total,
      used,
      available,
      usagePercent,
      warning: usagePercent > DISK_USAGE_THRESHOLD
    };
  } catch (error) {
    logger.error('Disk usage check failed', {
      error: (error as Error).message
    });
    return { total: 0, used: 0, available: 0, usagePercent: 0, warning: false };
  }
}

// Check disk usage every hour
setInterval(checkDiskUsage, 3600000);
```

## Examples

### Example: Complete Invoice Generation Flow

```
1. User clicks "Generate Invoice" on order page
2. Frontend: POST /api/bills with order data
3. Backend: billController.create()
   a. Validates request data
   b. Creates bill record in MongoDB
   c. Calls generateInvoicePDF() with bill data
   d. PDF is saved to: uploads/{branchId}/orders/{orderId}/INV-2024-0001.pdf
   e. Returns bill with PDF URL
4. Frontend: Displays "Download Invoice" link pointing to /uploads/.../INV-2024-0001.pdf
5. User clicks download → browser fetches static file via express.static
```

### Example: File URL Resolution

```typescript
// Given these inputs:
const branchId = '6650a1b2c3d4e5f6a7b8c9d0';
const orderId = '6650b2c3d4e5f6a7b8c9d0e1';
const invoiceNumber = 'INV-2024-0042';

// The file is saved at:
// D:\123\server\uploads\6650a1b2c3d4e5f6a7b8c9d0\orders\6650b2c3d4e5f6a7b8c9d0e1\INV-2024-0042.pdf

// The URL returned is:
// /uploads/6650a1b2c3d4e5f6a7b8c9d0/orders/6650b2c3d4e5f6a7b8c9d0e1/INV-2024-0042.pdf

// The frontend uses this URL directly:
<a href="/uploads/6650a1b2c3d4e5f6a7b8c9d0/orders/6650b2c3d4e5f6a7b8c9d0e1/INV-2024-0042.pdf"
   target="_blank">
  Download Invoice
</a>
```

## Bad Examples

### Bad: Storing Files in Source Directory

```typescript
// ❌ BAD - Files mixed with source code, committed to git
const filePath = path.join(__dirname, '../../data/invoices/', fileName);
await fs.writeFile(filePath, pdfBuffer);

// ✅ GOOD - Files in dedicated uploads directory
const filePath = fileStorage.buildPath({
  branchId,
  subdirectory: `orders/${orderId}`,
  fileName: `${invoiceNumber}.pdf`
});
await fs.writeFile(filePath, pdfBuffer);
```

### Bad: No Branch Isolation

```typescript
// ❌ BAD - All branches share the same directory
const filePath = path.join(UPLOADS_ROOT, 'invoices', fileName);

// ✅ GOOD - Branch-scoped paths
const filePath = fileStorage.buildPath({
  branchId,
  subdirectory: 'invoices',
  fileName
});
```

### Bad: No File Cleanup

```typescript
// ❌ BAD - Orphaned files after record deletion
async function deleteCustomer(id: string) {
  await Customer.findByIdAndDelete(id);
  // Files are now orphaned!
}

// ✅ GOOD - Clean up files with record
async function deleteCustomer(id: string) {
  const customer = await Customer.findById(id);
  if (customer?.photo) {
    await fileStorage.deleteFile(customer.photo);
  }
  await fileStorage.deleteDirectory(
    path.join(UPLOADS_ROOT, customer.branch, 'customers', id)
  );
  await Customer.findByIdAndDelete(id);
}
```

### Bad: Unvalidated File Uploads

```typescript
// ❌ BAD - No file type or size validation
router.post('/upload', upload.single('file'), async (req, res) => {
  // Could be any file type, any size
  // Could be an executable!
});

// ✅ GOOD - Strict validation
router.post('/upload',
  upload.single('file'),
  validateFile({
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
  }),
  processUpload('documents'),
  controller.handleUpload
);
```

### Bad: Serving Uploads Without Security Headers

```typescript
// ❌ BAD - No security headers on static files
app.use('/uploads', express.static('uploads'));

// ✅ GOOD - Proper headers
app.use('/uploads', express.static('uploads', {
  maxAge: '1h',
  setHeaders: (res) => {
    res.setHeader('X-Robots-Tag', 'noindex');
    res.setHeader('Cache-Control', 'private, max-age=3600');
  }
}));
```

## Tradeoffs

### Local Disk vs Cloud Storage

| Approach | Pros | Cons |
|----------|------|------|
| **Local Disk** | Simple, no cost, no latency | Single server, manual backup, no CDN |
| **AWS S3** | Scalable, CDN, versioning | Cost, complexity, latency |
| **Hybrid** | Local for dev, S3 for prod | Extra abstraction layer |

**Decision for KMJ ERP**: Start with local disk. The system runs on a single server for now. When scaling to multiple servers or needing CDN, migrate to S3 with minimal code changes (swap `FileStorage` implementation).

### PDF Generation Library

| Library | Pros | Cons |
|---------|------|------|
| **PDFKit** | Simple API, lightweight | Limited styling, no templates |
| **Puppeteer** | HTML-to-PDF, beautiful layouts | Heavy, requires Chromium |
| **pdfmake** | Declarative, good for complex layouts | Larger bundle |

**Decision**: PDFKit for invoice generation. Simple, lightweight, sufficient for structured invoice layouts.

### File Naming Strategy

| Strategy | Example | Pros | Cons |
|----------|---------|------|------|
| **UUID** | `a1b2c3d4.pdf` | No collisions, no guessing | Not human-readable |
| **Business Key** | `INV-2024-0042.pdf` | Readable, traceable | Collision possible if not careful |
| **Timestamp + Random** | `1716000000-abc.pdf` | Sorted by time, unique | Less readable |

**Decision**: Business key (invoice number, order ID) for generated files. Timestamp + random for user uploads.

### Storage Limits Per Branch

```
Default limit: 1GB per branch
Warning at: 85% usage
Hard limit: 95% usage (reject new uploads)
```

Monitor with `checkDiskUsage()` and alert when approaching limits.

## Cross-References

- **06-architecture.md** — System architecture including file storage layer
- **10-multi-tenancy.md** — Branch isolation for file paths
- **15-authentication.md** — Auth required for file access
- **18-validation.md** — File validation rules
- **20-logging.md** — File operation logging
- **21-performance.md** — Static file caching, PDF generation performance
- **22-security.md** — File upload security, path traversal prevention
- **23-testing.md** — Mocking file operations in tests

## AI Instructions

1. **Always scope files by branch** — use `uploads/{branchId}/{subdirectory}/{fileName}`. Never store files at the root uploads level.
2. **Always validate file uploads** — check type, size, and content. Never trust client-provided file metadata.
3. **Always clean up files on record deletion** — delete associated files and directories when database records are removed.
4. **Use deterministic file paths** — compute paths from business data (order ID, invoice number). Avoid random paths that require database lookups.
5. **Never store files in source control** — ensure `uploads/` is in `.gitignore`. Store only code in git.
6. **Set appropriate cache headers** — static files should have `maxAge: 1h`. PDFs should have `Cache-Control: private`.
7. **Generate PDFs as streams** — use `PassThrough` streams to avoid buffering entire PDFs in memory.
8. **Monitor disk usage** — log warnings at 85% usage. Reject uploads at 95%.
9. **Log all file operations** — saves, deletes, and errors must be logged with branch ID and file path.
10. **Test file operations** — mock `fs` operations in unit tests. Use temp directories in integration tests. Never write to the real uploads directory during tests.
