require('dotenv').config()
const debug = require('debug')('lake:web')
const fastify = require('fastify')({ logger: process.env.WEB_LOG === '1' })

const { query, disconnect } = require('./helper/mysqlHelper')
const factory = require('./helper/handlingDataHelper')

fastify.register(require('fastify-cors'), {
  // put your options here
})

// Declare a route
fastify.get('/block/list', async (request, reply) => {
  let pageSize = parseInt(request.query.page_size)
  if (!pageSize || pageSize <= 0 || pageSize > 100) {
    pageSize = 15
  }
  let pageIndex = parseInt(request.query.page_index)
  if (!pageIndex || pageIndex <= 0) {
    pageIndex = 1
  }
  const offset = (pageIndex - 1) * pageSize
  return query(factory.makeListBlockQuery(pageSize, offset))
})

fastify.get('/block/count', async (request, reply) => {
  return query(factory.makeCountQuery('block'))
})

fastify.get('/block/:height', async (request, reply) => {
  return query(factory.makeOneBlockQuery(request.params.height))
})

fastify.get('/block/latest', async (request, reply) => {
  return query(factory.makeLastBlock())
})

fastify.get('/tx/list', async (request, reply) => {
  let pageSize = parseInt(request.query.page_size)
  if (!pageSize || pageSize <= 0 || pageSize > 100) {
    pageSize = 15
  }
  let pageIndex = parseInt(request.query.page_index)
  if (!pageIndex || pageIndex <= 0) {
    pageIndex = 1
  }

  const offset = (pageIndex - 1) * pageSize
  const filter = {}
  if (request.query.hash) {
    filter.hash = request.query.hash
  }
  if (request.query.height) {
    filter.height = request.query.height
  }
  if (request.query.from) {
    filter.from = request.query.from
  }
  if (request.query.to) {
    filter.to = request.query.to
  }
  return query(factory.makeListTxQuery(filter, pageSize, offset))
})

fastify.get('/tx/count', async (request, reply) => {
  return query(factory.makeCountQuery('tx'))
})

fastify.get('/tx/:hash', async (request, reply) => {
  return query(factory.makeOneTxQuery(request.params.hash))
})

// Run the server!
const start = async () => {
  try {
    await fastify.listen(3000, '0.0.0.0')
    fastify.log.info(`server listening on ${fastify.server.address().port}`)
  } catch (err) {
    fastify.log.error(err)
    disconnect(err => {
      debug(err)
      process.exit(1)
    })
  }
}
start()
