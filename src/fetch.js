require('dotenv').config()

const debug = require('debug')('lake:fetch')

const { IceteaWeb3 } = require('@glitchdefi/web3')
const web3 = new IceteaWeb3(process.env.RPC_URL)

const mysqlHelper = require('./helper/mysqlHelper')
const { query, disconnect } = mysqlHelper

const { fetchOldBlocks, fetchOldTxs } = require('./fetchOldData')

const { makeLastBlock, makeLastTx } = require('./helper/handlingDataHelper')

const close = () => {
  const unsub = (global._sub && global._sub.unsubscribe) ? global._sub.unsubscribe() : Promise.resolve(undefined)
  unsub.finally(() => {
    Promise.resolve(web3.close()).finally(disconnect(debug))
  })
}

const handleError = error => {
  debug(error)
  close()

  // for some reason, it does not exit
  setTimeout(() => {
    process.exit(1)
  }, 5000)
}

const fetchData = async (fromBlockHeight, toBlockHeight, fromTxHeight, toTxHeight) => {
  try {
    await fetchOldBlocks(fromBlockHeight, toBlockHeight)
    await fetchOldTxs(fromTxHeight, toTxHeight)
  } catch (error) {
    handleError(error)
  }
}

let latestBlockHeight
const fetchAtInterval = async (fromBlockHeight, fromTxHeight) => {
  try {
    if (!fromBlockHeight) {
      // get last fetch block
      const lastFetchedBlock = await query(makeLastBlock(['height']))
      fromBlockHeight = lastFetchedBlock.length ? (lastFetchedBlock[0].height || 0) + 1 : 1
    }

    if (!fromTxHeight) {
      const lastFetchedTx = await query(makeLastTx(['height']))
      fromTxHeight = lastFetchedTx.length ? (lastFetchedTx[0].height || 0) + 1 : 1
    }

    const blockBatchSize = +process.env.BLOCK_BATCH_SIZE || 10000
    const txBatchSize = blockBatchSize

    if (!latestBlockHeight ||
      latestBlockHeight < fromBlockHeight ||
      latestBlockHeight < fromTxHeight) {
      // Get latest block
      latestBlockHeight = (await web3.getBlocks({ minHeight: 1, maxHeight: 1 })).last_height
    }
    // debug(latestBlock)
    const toBlockHeight = Math.min(latestBlockHeight, fromBlockHeight + blockBatchSize)
    const toTxHeight = Math.min(latestBlockHeight, fromTxHeight + txBatchSize)

    await fetchData(fromBlockHeight, toBlockHeight, fromTxHeight, toTxHeight)
    fromBlockHeight = toBlockHeight + 1
    fromTxHeight = toTxHeight + 1

    // redo every x seconds
    setTimeout(() => {
      fetchAtInterval(fromBlockHeight, fromTxHeight)
    }, +process.env.FETCH_INTERVAL || 1500)
  } catch (error) {
    handleError(error)
  }
}

// const watchNewBlock = async () => {
//   global._sub = web3.subscribe('NewBlockHeader', (error, result) => {
//     if (error) {
//       handleError(error)
//       return
//     }

//     const height = result.data.value.header.height
//     fetchData(height - 1, height, height - 1, height)
//   })
// }

const start = () => {
  // exit in case the websocket is lost (e.g. rpc restarts), so pm2 can restart things
  web3.onError(handleError)

  // await fetchAtInterval()
  fetchAtInterval()
  // watchNewBlock()
}

start()
