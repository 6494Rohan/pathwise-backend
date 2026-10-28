import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
// Every PDF page is billed as input tokens; a resume rarely needs more.
export const MAX_RESUME_PAGES = 4;
const URL_TTL_SECONDS = 300;
const PDF_MAGIC = '%PDF-';
const UUID_PDF = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

const s3 = new S3Client({});

const prefixOf = (userId: string) => `resumes/${userId}/`;

export const isOwnResumeKey = (userId: string, key: string) =>
  key.startsWith(prefixOf(userId)) && UUID_PDF.test(key.slice(prefixOf(userId).length));

// The size and type limits are part of the signed policy, so S3 itself rejects anything else.
export const createResumeUpload = async (bucket: string, userId: string) => {
  const key = `${prefixOf(userId)}${randomUUID()}.pdf`;
  const { url, fields } = await createPresignedPost(s3, {
    Bucket: bucket,
    Key: key,
    Conditions: [
      ['content-length-range', 1, MAX_RESUME_BYTES],
      ['eq', '$Content-Type', 'application/pdf'],
    ],
    Fields: { 'Content-Type': 'application/pdf' },
    Expires: URL_TTL_SECONDS,
  });
  return { key, url, fields, maxBytes: MAX_RESUME_BYTES, expiresInSeconds: URL_TTL_SECONDS };
};

// Counts page objects in the raw file. PDFs that pack them into compressed streams count as 0 and pass.
export const countPdfPages = (pdf: Buffer) => pdf.toString('latin1').match(/\/Type\s*\/Page(?![a-zA-Z])/g)?.length ?? 0;

// Word and online converters often add owner-password protection; Gemini rejects any encrypted PDF.
export const isEncryptedPdf = (pdf: Buffer) => /\/Encrypt(?![a-zA-Z])/.test(pdf.toString('latin1'));

export type ResumePdfProblem = 'not_pdf' | 'too_large' | 'too_many_pages' | 'encrypted';

export const readResumePdf = async (bucket: string, key: string): Promise<{ pdf: Buffer } | { problem: ResumePdfProblem }> => {
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!object.Body) return { problem: 'not_pdf' };
  if ((object.ContentLength ?? 0) > MAX_RESUME_BYTES) return { problem: 'too_large' };
  const pdf = Buffer.from(await object.Body.transformToByteArray());
  if (pdf.subarray(0, PDF_MAGIC.length).toString('latin1') !== PDF_MAGIC) return { problem: 'not_pdf' };
  if (isEncryptedPdf(pdf)) return { problem: 'encrypted' };
  if (countPdfPages(pdf) > MAX_RESUME_PAGES) return { problem: 'too_many_pages' };
  return { pdf };
};

export const deleteResumePdf = (bucket: string, key: string) => s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));

const attachmentName = (fileName: string) => fileName.replace(/["\\\r\n]/g, '_');

export const createResumeDownloadUrl = (bucket: string, key: string, fileName: string) =>
  getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentType: 'application/pdf',
      ResponseContentDisposition: `attachment; filename="${attachmentName(fileName)}"`,
    }),
    { expiresIn: URL_TTL_SECONDS }
  );
