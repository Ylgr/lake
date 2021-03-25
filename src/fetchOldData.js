require('dotenv').config()
const debug = require('debug')('lake:fetch')

const { GlitchWeb3 } = require('@glitchdefi/web3')
const web3 = new GlitchWeb3(process.env.RPC_URL)

const handlingDataHelper = require('./helper/handlingDataHelper')
const { generateOldBlockEventQuery, generateOldTxEventQuery } = handlingDataHelper

const mysqlHelper = require('./helper/mysqlHelper')
const { query } = mysqlHelper

/**
 * Fetch block data from `from` block height to `to` block height
 * @param {*} from block height
 * @param {*} to block height
 */
function fetchOldBlocks (from, to) {
  if (to < from) return

  const promises = []
  let start = from
  const step = 20 // tendermint support MAX of 20, don't increase to > 20
  let end = Math.min(to, start + step - 1)

  while (start <= end) {
    const p = web3.getBlocks({ minHeight: start, maxHeight: end }).then((result) => {
      // array of blocks
      const stepPromises = result.block_metas.reduce((list, bl) => {
        const blockQuery = generateOldBlockEventQuery(bl)
        list.push(query(blockQuery))
        return list
      }, [])
      return Promise.all(stepPromises)
    })
    promises.push(p)

    // for next round
    start = end + 1
    end = Math.min(to, start + step - 1)
  }
  return Promise.all(promises)
}

function fetchTxPage (height, page = 1, perPage = 100, fetched = 0) {
  return web3.searchTransactions(`tx.height=${height}`, { page, per_page: perPage }).then((result) => {
    // add txs promise
    const getTxs = result.txs.reduce((arr, tx) => {
      const decoded = tx // web3.utils.decodeTxResult(tx)
      const mysqlQuery = generateOldTxEventQuery(decoded)
      arr.push(query(mysqlQuery))
      return arr
    }, [])

    // search for next pages
    // note that, if setting 'page' exceeding number of pages, tendermint simply ignore it :(
    // so we'll have to deal with totalCount
    const totalCount = Number(result.total_count)
    fetched += result.txs.length
    if (fetched < totalCount || result.txs.length >= perPage) {
      getTxs.push(fetchTxPage(height, page + 1, perPage, fetched))
    }

    return Promise.all(getTxs)
  })
}

/**
 * Fetch transaction data from `from` block height to `to` block height
 * @param {*} from block height
 * @param {*} to block height
 */
function fetchOldTxs (from, to) {
  if (to < from) return

  const promises = []
  for (let i = from; i <= to; i++) {
    promises.push(fetchTxPage(i))
  }
  return Promise.all(promises)
}

module.exports = { fetchOldBlocks, fetchOldTxs }
