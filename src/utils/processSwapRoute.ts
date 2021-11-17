import { Protocol } from '@uniswap/router-sdk'
import { Currency, CurrencyAmount } from '@uniswap/sdk-core'
import { IV2PoolProvider, IV3PoolProvider, routeAmountsToString, SwapRoute } from '@uniswap/smart-order-router'
import { GetQuoteResult, V2PoolInRoute, V3PoolInRoute } from 'state/routing/types'

// transforms a SwapRoute into a GetQuoteResult
// from routing-api (https://github.com/Uniswap/routing-api/blob/main/lib/handlers/quote/quote.ts#L243-L311)
export function processSwapRoute(
  type: 'exactIn' | 'exactOut',
  amount: CurrencyAmount<Currency>,
  v3PoolProvider: IV3PoolProvider,
  v2PoolProvider: IV2PoolProvider,
  {
    quote,
    quoteGasAdjusted,
    route,
    estimatedGasUsed,
    estimatedGasUsedQuoteToken,
    estimatedGasUsedUSD,
    gasPriceWei,
    methodParameters,
    blockNumber,
  }: SwapRoute
): GetQuoteResult {
  const routeResponse: Array<V3PoolInRoute[] | V2PoolInRoute[]> = []

  for (const subRoute of route) {
    const { amount, quote, tokenPath } = subRoute

    if (subRoute.protocol == Protocol.V3) {
      const pools = subRoute.route.pools
      const curRoute: V3PoolInRoute[] = []
      for (let i = 0; i < pools.length; i++) {
        const nextPool = pools[i]
        const tokenIn = tokenPath[i]
        const tokenOut = tokenPath[i + 1]

        let edgeAmountIn = undefined
        if (i == 0) {
          edgeAmountIn = type === 'exactIn' ? amount.quotient.toString() : quote.quotient.toString()
        }

        let edgeAmountOut = undefined
        if (i == pools.length - 1) {
          edgeAmountOut = type === 'exactIn' ? quote.quotient.toString() : amount.quotient.toString()
        }

        curRoute.push({
          type: 'v3-pool',
          // TODO: consider not processing address since it's not used
          address: v3PoolProvider.getPoolAddress(nextPool.token0, nextPool.token1, nextPool.fee).poolAddress,
          tokenIn: {
            chainId: tokenIn.chainId,
            decimals: tokenIn.decimals,
            address: tokenIn.address,
            symbol: tokenIn.symbol,
          },
          tokenOut: {
            chainId: tokenOut.chainId,
            decimals: tokenOut.decimals,
            address: tokenOut.address,
            symbol: tokenOut.symbol,
          },
          fee: nextPool.fee.toString(),
          liquidity: nextPool.liquidity.toString(),
          sqrtRatioX96: nextPool.sqrtRatioX96.toString(),
          tickCurrent: nextPool.tickCurrent.toString(),
          amountIn: edgeAmountIn,
          amountOut: edgeAmountOut,
        })
      }

      routeResponse.push(curRoute)
    } else if (subRoute.protocol == Protocol.V2) {
      const pools = subRoute.route.pairs
      const curRoute: V2PoolInRoute[] = []
      for (let i = 0; i < pools.length; i++) {
        const nextPool = pools[i]
        const tokenIn = tokenPath[i]
        const tokenOut = tokenPath[i + 1]

        let edgeAmountIn = undefined
        if (i == 0) {
          edgeAmountIn = type == 'exactIn' ? amount.quotient.toString() : quote.quotient.toString()
        }

        let edgeAmountOut = undefined
        if (i == pools.length - 1) {
          edgeAmountOut = type == 'exactIn' ? quote.quotient.toString() : amount.quotient.toString()
        }

        const reserve0 = nextPool.reserve0
        const reserve1 = nextPool.reserve1

        curRoute.push({
          type: 'v2-pool',
          address: v2PoolProvider.getPoolAddress(nextPool.token0, nextPool.token1).poolAddress,
          tokenIn: {
            chainId: tokenIn.chainId,
            decimals: tokenIn.decimals,
            address: tokenIn.address,
            symbol: tokenIn.symbol,
          },
          tokenOut: {
            chainId: tokenOut.chainId,
            decimals: tokenOut.decimals,
            address: tokenOut.address,
            symbol: tokenOut.symbol,
          },
          reserve0: {
            token: {
              chainId: reserve0.currency.wrapped.chainId,
              decimals: reserve0.currency.wrapped.decimals,
              address: reserve0.currency.wrapped.address,
              symbol: reserve0.currency.wrapped.symbol,
            },
            quotient: reserve0.quotient.toString(),
          },
          reserve1: {
            token: {
              chainId: reserve1.currency.wrapped.chainId,
              decimals: reserve1.currency.wrapped.decimals,
              address: reserve1.currency.wrapped.address,
              symbol: reserve1.currency.wrapped.symbol,
            },
            quotient: reserve1.quotient.toString(),
          },
          amountIn: edgeAmountIn,
          amountOut: edgeAmountOut,
        })
      }

      routeResponse.push(curRoute)
    }
  }

  const result: GetQuoteResult = {
    methodParameters,
    blockNumber: blockNumber.toString(),
    amount: amount.quotient.toString(),
    amountDecimals: amount.toExact(),
    quote: quote.quotient.toString(),
    quoteDecimals: quote.toExact(),
    quoteGasAdjusted: quoteGasAdjusted.quotient.toString(),
    quoteGasAdjustedDecimals: quoteGasAdjusted.toExact(),
    gasUseEstimateQuote: estimatedGasUsedQuoteToken.quotient.toString(),
    gasUseEstimateQuoteDecimals: estimatedGasUsedQuoteToken.toExact(),
    gasUseEstimate: estimatedGasUsed.toString(),
    gasUseEstimateUSD: estimatedGasUsedUSD.toExact(),
    gasPriceWei: gasPriceWei.toString(),
    route: routeResponse,
    routeString: routeAmountsToString(route),
  }

  return result
}