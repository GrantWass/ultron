import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

export const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export const S3_BUCKET = process.env.AWS_S3_BUCKET!

/** Upload a JSON payload as gzip-compressed bytes and return the S3 key. */
export async function uploadRecording(
  key: string,
  data: Buffer,
): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: data,
    ContentType: 'application/json',
    ContentEncoding: 'gzip',
    // S3 bucket lifecycle rule should expire objects after 7 days.
    // Configure that on the bucket itself (AWS Console / Terraform):
    //   Rule: prefix=recordings/, expiration=7 days
  }))
}

/** Download a recording and return the raw buffer. */
export async function downloadRecording(key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }))
  const chunks: Uint8Array[] = []
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
