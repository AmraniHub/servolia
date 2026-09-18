import { deflateRawSync } from "node:zlib";

/**
 * A ZIP FILE, WITH NO DEPENDENCY.
 *
 * This exists to hand a client a copy of their own website. That is one button
 * on one page, used a handful of times a year, and it is not worth a package
 * on the critical path of a site that takes payments — a zip library is a
 * supply-chain surface, and every one of them would be doing what the eighty
 * lines below do.
 *
 * DEFLATE comes from node:zlib, which is built in. The rest is the container
 * format: a header before each file, a directory at the end listing them, and
 * a record saying where that directory starts.
 *
 * Deliberately not streaming. These are small static sites — a few megabytes —
 * and a buffer that is built and returned cannot leave a half-written archive
 * behind if something throws in the middle.
 */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

export function crc32(buf: Buffer): number {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

export interface ZipEntry {
  /** Path inside the archive, forward slashes, no leading slash. */
  path: string;
  data: Buffer;
}

/**
 * MS-DOS date and time, which is what ZIP stores.
 *
 * Every entry gets the SAME timestamp — the moment the archive was made — so
 * building the same site twice produces the same bytes. A per-file mtime would
 * be a lie anyway: these files come from a git tree, which does not have one.
 */
function dosStamp(at: Date): { time: number; date: number } {
  return {
    time: ((at.getHours() << 11) | (at.getMinutes() << 5) | (at.getSeconds() >> 1)) & 0xffff,
    date: (((at.getFullYear() - 1980) << 9) | ((at.getMonth() + 1) << 5) | at.getDate()) & 0xffff,
  };
}

export function makeZip(entries: ZipEntry[], at = new Date()): Buffer {
  const { time, date } = dosStamp(at);
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const e of entries) {
    const name = Buffer.from(e.path.replace(/\\/g, "/").replace(/^\/+/, ""), "utf8");
    const crc = crc32(e.data);
    const deflated = deflateRawSync(e.data);
    /* Store rather than deflate when compression makes it bigger, which it
       does for anything already compressed — every PNG and JPEG on the site. */
    const useDeflate = deflated.length < e.data.length;
    const body = useDeflate ? deflated : e.data;
    const method = useDeflate ? 8 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, body);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4); // version made by
    dir.writeUInt16LE(20, 6); // version needed
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(method, 10);
    dir.writeUInt16LE(time, 12);
    dir.writeUInt16LE(date, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(body.length, 20);
    dir.writeUInt32LE(e.data.length, 24);
    dir.writeUInt16LE(name.length, 28);
    dir.writeUInt32LE(0, 38); // external attributes
    dir.writeUInt32LE(offset, 42);
    central.push(dir, name);

    offset += local.length + name.length + body.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralBuf, end]);
}
