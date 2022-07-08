import { createYoga } from '@graphql-yoga/common'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Docs: https://vercel.com/docs/concepts/functions/serverless-functions

const app = createYoga<{
  req: VercelRequest
  res: VercelResponse
}>()

export default app
