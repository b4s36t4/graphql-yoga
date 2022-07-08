// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { createYoga } from '@graphql-yoga/common'
import type { NextApiRequest, NextApiResponse } from 'next'

export const config = {
  api: {
    // Disable body parsing (required for file uploads)
    bodyParser: false,
  },
}

export default createYoga<{
  req: NextApiRequest
  res: NextApiResponse
}>()
