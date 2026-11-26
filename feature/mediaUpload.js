const DISCORD_MEDIA_HOSTS = new Set([
  "cdn.discordapp.com",
  "media.discordapp.net"
]);

const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024;

function attachment(data, name) {
  if (!(data instanceof Uint8Array) || !data.byteLength) {
    throw new Error("The media file is empty or invalid.");
  }

  return {
    attachment: Buffer.isBuffer(data) ? data : Buffer.from(data),
    name
  };
}

async function downloadAttachment(source, fallbackName = "attachment") {
  const url = new URL(source.url);

  if (
    url.protocol !== "https:" ||
    !DISCORD_MEDIA_HOSTS.has(url.host) ||
    url.username ||
    url.password
  ) {
    throw new Error("Expected a Discord attachment URL.");
  }

  if (source.size > MAX_DOWNLOAD_BYTES) {
    throw new Error("The source file exceeds the 100 MB download limit.");
  }

  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(30_000)
  });

  if (!response.ok) {
    const error = new Error(`Discord CDN returned HTTP ${response.status}.`);
    error.code = `CDN_${response.status}`;
    await response.body?.cancel();
    throw error;
  }

  const chunks = [];
  let bytes = 0;

  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    if (bytes > MAX_DOWNLOAD_BYTES) {
      throw new Error("The source file exceeds the 100 MB download limit.");
    }
    chunks.push(chunk);
  }

  const name =
    source.name ||
    decodeURIComponent(url.pathname.split("/").pop()) ||
    fallbackName;

  return attachment(Buffer.concat(chunks, bytes), name);
}

module.exports = { attachment, downloadAttachment };
