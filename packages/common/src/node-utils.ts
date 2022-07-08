import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Socket } from 'node:net'
import { isAsyncIterable } from '@graphql-tools/utils'

export interface NodeRequest {
  protocol?: string
  hostname?: string
  body?: any
  url?: string
  method?: string
  headers: any
  req?: IncomingMessage
  raw?: IncomingMessage
  socket?: Socket
  query?: any
}

function buildFullUrl(nodeRequest: NodeRequest) {
  const hostname =
    nodeRequest.hostname ||
    nodeRequest.socket?.localAddress
      ?.split('ffff')
      ?.join('')
      ?.split(':')
      ?.join('') ||
    nodeRequest.headers?.host?.split(':')[0] ||
    'localhost'

  const port = nodeRequest.socket?.localPort || 80
  const protocol = nodeRequest.protocol || 'http'
  const endpoint = nodeRequest.url || '/graphql'

  return `${protocol}://${hostname}:${port}${endpoint}`
}

function configureSocket(rawRequest: NodeRequest) {
  rawRequest?.socket?.setTimeout?.(0)
  rawRequest?.socket?.setNoDelay?.(true)
  rawRequest?.socket?.setKeepAlive?.(true)
}

export function getNodeRequest(
  nodeRequest: NodeRequest,
  RequestCtor: typeof Request,
): Request {
  const rawRequest = nodeRequest.raw || nodeRequest.req || nodeRequest
  configureSocket(rawRequest)
  const fullUrl = buildFullUrl(rawRequest)
  if (nodeRequest.query) {
    const urlObj = new URL(fullUrl)
    for (const queryName in nodeRequest.query) {
      const queryValue = nodeRequest.query[queryName]
      urlObj.searchParams.set(queryName, queryValue)
    }
  }
  const baseRequestInit: RequestInit = {
    method: nodeRequest.method,
    headers: nodeRequest.headers,
  }

  if (nodeRequest.method !== 'POST') {
    return new RequestCtor(fullUrl, baseRequestInit)
  }

  /**
   * Some Node server frameworks like Serverless Express sends a dummy object with body but as a Buffer not string
   * so we do those checks to see is there something we can use directly as BodyInit
   * because the presence of body means the request stream is already consumed and,
   * rawRequest cannot be used as BodyInit/ReadableStream by Fetch API in this case.
   */
  const maybeParsedBody = nodeRequest.body
  if (maybeParsedBody != null && Object.keys(maybeParsedBody).length > 0) {
    if (
      typeof maybeParsedBody === 'string' ||
      maybeParsedBody[Symbol.toStringTag] === 'Uint8Array' ||
      maybeParsedBody[Symbol.toStringTag] === 'Blob' ||
      maybeParsedBody[Symbol.toStringTag] === 'FormData' ||
      maybeParsedBody[Symbol.toStringTag] === 'URLSearchParams' ||
      isAsyncIterable(maybeParsedBody)
    ) {
      return new RequestCtor(fullUrl, {
        ...baseRequestInit,
        body: maybeParsedBody as any,
      })
    }
    const request = new RequestCtor(fullUrl, {
      ...baseRequestInit,
    })
    if (!request.headers.get('content-type')?.includes('json')) {
      request.headers.set('content-type', 'application/json')
    }
    return new Proxy(request, {
      get: (target, prop: keyof Request, receiver) => {
        switch (prop) {
          case 'json':
            return async () => maybeParsedBody
          default:
            return Reflect.get(target, prop, receiver)
        }
      },
    })
  }

  return new RequestCtor(fullUrl, {
    headers: nodeRequest.headers,
    method: nodeRequest.method,
    body: rawRequest as any,
  })
}

export async function sendNodeResponse(
  { headers, status, statusText, body }: Response,
  serverResponse: ServerResponse,
) {
  headers.forEach((value, name) => {
    serverResponse.setHeader(name, value)
  })
  serverResponse.statusCode = status
  serverResponse.statusMessage = statusText
  if (body == null) {
    serverResponse.end()
    return Promise.resolve()
  }
  if (body[Symbol.toStringTag] === 'Uint8Array') {
    serverResponse.end(body)
    return Promise.resolve()
  }
  for await (const chunk of body) {
    if (!serverResponse.write(chunk)) {
      return
    }
  }
  serverResponse.end()
}
