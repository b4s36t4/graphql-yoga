import { createYoga } from '@graphql-yoga/common'
import { configure } from '@vendia/serverless-express'

const app = createYoga()

export const handler = configure({
  app,
  log: app.logger,
})
