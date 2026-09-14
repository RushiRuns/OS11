import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

// Precomputed CRC32 table
const crcTable: Uint32Array = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[i] = c >>> 0;
}

export function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Buffer;
}

/**
 * Creates a standard PKZip buffer from an array of file entries.
 */
export function createZipArchive(entries: ZipEntry[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const filenameBuf = Buffer.from(entry.name.replace(/\\/g, '/'), 'utf8');
    const uncompressedData = entry.data;
    const uncompressedSize = uncompressedData.length;
    const checksum = crc32(uncompressedData);

    // Deflate
    const compressedData = zlib.deflateRawSync(uncompressedData);
    const compressedSize = compressedData.length;

    // DOS Date/Time (constant default: 2026-01-01 12:00:00)
    const dosTime = 0x6000;
    const dosDate = 0x5c21;

    // Local Header (30 bytes + filename length + compressed data)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
    localHeader.writeUInt16LE(20, 4);          // Version needed (2.0)
    localHeader.writeUInt16LE(0x0800, 6);      // Flags: UTF-8 filename
    localHeader.writeUInt16LE(8, 8);           // Compression: Deflate
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(filenameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);          // Extra field length

    const localChunk = Buffer.concat([localHeader, filenameBuf, compressedData]);
    localHeaders.push(localChunk);

    // Central Directory Header (46 bytes + filename length)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Central directory file header signature
    centralHeader.writeUInt16LE(20, 4);         // Version made by (2.0)
    centralHeader.writeUInt16LE(20, 6);         // Version needed
    centralHeader.writeUInt16LE(0x0800, 8);     // Flags: UTF-8 filename
    centralHeader.writeUInt16LE(8, 10);         // Compression: Deflate
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(filenameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);         // Extra field length
    centralHeader.writeUInt16LE(0, 32);         // File comment length
    centralHeader.writeUInt16LE(0, 34);         // Disk number start
    centralHeader.writeUInt16LE(0, 36);         // Internal file attributes
    centralHeader.writeUInt32LE(0, 38);         // External file attributes
    centralHeader.writeUInt32LE(offset, 42);    // Relative offset of local header

    const centralChunk = Buffer.concat([centralHeader, filenameBuf]);
    centralHeaders.push(centralChunk);

    offset += localChunk.length;
  }

  const centralDirBuffer = Buffer.concat(centralHeaders);
  const centralDirSize = centralDirBuffer.length;
  const centralDirOffset = offset;

  // End of Central Directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);                  // Signature
  eocd.writeUInt16LE(0, 4);                           // Disk number
  eocd.writeUInt16LE(0, 6);                           // Start disk
  eocd.writeUInt16LE(entries.length, 8);              // Entries on disk
  eocd.writeUInt16LE(entries.length, 10);             // Total entries
  eocd.writeUInt32LE(centralDirSize, 12);             // Central directory size
  eocd.writeUInt32LE(centralDirOffset, 16);           // Central directory offset
  eocd.writeUInt16LE(0, 20);                          // Comment length

  return Buffer.concat([...localHeaders, centralDirBuffer, eocd]);
}

/**
 * Extracts all files from a PKZip buffer.
 */
export function extractZipArchive(buffer: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  
  // Find End of Central Directory (search from end of file backwards)
  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error('Invalid ZIP archive: End of Central Directory record not found.');
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);

  let curOffset = centralDirOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (buffer.readUInt32LE(curOffset) !== 0x02014b50) {
      throw new Error(`Corrupt ZIP archive at central directory entry ${i}`);
    }

    const compressionMethod = buffer.readUInt16LE(curOffset + 10);
    const compressedSize = buffer.readUInt32LE(curOffset + 20);
    const uncompressedSize = buffer.readUInt32LE(curOffset + 24);
    const filenameLen = buffer.readUInt16LE(curOffset + 28);
    const extraLen = buffer.readUInt16LE(curOffset + 30);
    const commentLen = buffer.readUInt16LE(curOffset + 32);
    const localHeaderOffset = buffer.readUInt32LE(curOffset + 42);

    const filename = buffer.toString('utf8', curOffset + 46, curOffset + 46 + filenameLen);
    curOffset += 46 + filenameLen + extraLen + commentLen;

    // Read local header
    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error(`Corrupt ZIP archive at local header for file ${filename}`);
    }

    const localFilenameLen = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
    const fileDataOffset = localHeaderOffset + 30 + localFilenameLen + localExtraLen;

    const compressedData = buffer.subarray(fileDataOffset, fileDataOffset + compressedSize);
    let extractedData: Buffer;

    if (compressionMethod === 0) {
      extractedData = Buffer.from(compressedData);
    } else if (compressionMethod === 8) {
      extractedData = zlib.inflateRawSync(compressedData);
    } else {
      throw new Error(`Unsupported ZIP compression method: ${compressionMethod}`);
    }

    if (extractedData.length !== uncompressedSize) {
      throw new Error(`Uncompressed size mismatch for ${filename}`);
    }

    entries.push({
      name: filename,
      data: extractedData,
    });
  }

  return entries;
}

/**
 * Packs a directory and optional extra virtual files into a ZIP archive on disk.
 */
export function createZipFileFromDirectory(
  sourceDir: string,
  outputFilePath: string,
  extraEntries: ZipEntry[] = []
): void {
  const entries: ZipEntry[] = [...extraEntries];

  if (fs.existsSync(sourceDir)) {
    const walk = (dir: string, base: string) => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const full = path.join(dir, item);
        const rel = path.join(base, item).replace(/\\/g, '/');
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          walk(full, rel);
        } else if (stat.isFile()) {
          entries.push({
            name: rel,
            data: fs.readFileSync(full),
          });
        }
      }
    };
    walk(sourceDir, '');
  }

  const archiveBuffer = createZipArchive(entries);
  const outDir = path.dirname(outputFilePath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(outputFilePath, archiveBuffer);
}
