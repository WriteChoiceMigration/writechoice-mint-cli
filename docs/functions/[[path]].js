export async function onRequest(context) {
  const { request, next } = context;
  const accept = request.headers.get('Accept') || '';

  if (accept.includes('text/markdown')) {
    const url = new URL(request.url);
    const mdPath = url.pathname.replace(/\/$/, '') + '.md';
    const mdResponse = await fetch(new Request(new URL(mdPath, url.origin).toString()));

    if (mdResponse.ok) {
      return new Response(mdResponse.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Vary': 'Accept',
        },
      });
    }
  }

  return next();
}
