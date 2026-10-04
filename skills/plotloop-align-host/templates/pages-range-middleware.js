// Safari 播 <video> 需要 206 分段响应；Pages 静态资源不处理 Range，这里补上。
export async function onRequest({ request, next }) {
  const range = request.headers.get('Range');
  const url = new URL(request.url);
  if (!url.pathname.endsWith('.mp4')) return next();
  const res = await next();
  if (!range || res.status !== 200) {
    const h = new Headers(res.headers); h.set('Accept-Ranges', 'bytes');
    return new Response(res.body, { status: res.status, headers: h });
  }
  const buf = await res.arrayBuffer();
  const size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  let start = m && m[1] !== '' ? +m[1] : NaN, end = m && m[2] !== '' ? +m[2] : NaN;
  if (isNaN(start)) { start = size - (isNaN(end) ? size : end); end = size - 1; }
  if (isNaN(end) || end >= size) end = size - 1;
  if (start > end || start >= size) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  const h = new Headers(res.headers);
  h.set('Content-Range', `bytes ${start}-${end}/${size}`);
  h.set('Content-Length', String(end - start + 1));
  h.set('Accept-Ranges', 'bytes');
  return new Response(buf.slice(start, end + 1), { status: 206, headers: h });
}
