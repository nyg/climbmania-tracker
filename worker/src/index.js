const toHit = (params, headers) => ({
  path: params.get('p'),
  title: params.get('t') ?? '',
  ref: params.get('r') ?? '',
  query: params.get('q') ?? '',
  event: params.get('e') === 'true',
  bot: Number(params.get('b') ?? 0),
  size: params.get('s') || undefined,
  ip: headers.get('CF-Connecting-IP'),
  user_agent: headers.get('User-Agent') ?? '',
  language: headers.get('Accept-Language')?.split(/[,;]/)[0] ?? '',
})

const forward = async (hit, env) => {
  const response = await fetch(`${env.GOATCOUNTER_URL}/api/v0/count`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GOATCOUNTER_TOKEN}`,
    },
    body: JSON.stringify({ hits: [hit] }),
  })
  if (!response.ok) {
    console.error(`GoatCounter responded ${response.status}: ${await response.text()}`)
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (url.pathname !== '/hit') return new Response(null, { status: 404 })
    if (request.method !== 'POST') return new Response(null, { status: 405 })
    if (request.headers.get('Origin') !== env.ALLOWED_ORIGIN) return new Response(null, { status: 403 })
    if (!url.searchParams.get('p')) return new Response(null, { status: 400 })

    ctx.waitUntil(forward(toHit(url.searchParams, request.headers), env))
    return new Response(null, { status: 204 })
  },
}
