export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const chart = body.chart;
    const message = String(body.message || "");

    if (!chart || !Array.isArray(chart.candles) || !chart.candles.length) {
      return Response.json({error:"No chart data was received."},{status:400});
    }

    if (!context.env.AI) {
      return Response.json({
        error:"Cloudflare Workers AI binding 'AI' is not configured."
      },{status:500});
    }

    const candles = chart.candles.slice(-250);

    const rows = candles.map((c,i) =>
      `${i} | ${new Date(c.time).toISOString()} | O ${c.open} | H ${c.high} | L ${c.low} | C ${c.close} | V ${c.volume}`
    ).join("\n");

    const system = `
You are SMC AI inside a cryptocurrency chart scanner.

The user has supplied the ACTUAL OHLCV candles currently loaded by their chart.
Analyze those candles directly. Never pretend you can see pixels or a screenshot.
Never invent prices, liquidity, signals, or candles.

Use this SMC methodology:
- meaningful swing highs/lows
- buy-side liquidity and sell-side liquidity
- liquidity sweep/SFP
- displacement
- CHoCH/MSS
- BOS
- FVG
- Order Block
- retracement
- market bias

A bullish liquidity sweep takes a meaningful low and reclaims it.
A bearish liquidity sweep takes a meaningful high and rejects below it.
A bullish FVG exists when a later candle low is above an earlier candle high.
A bearish FVG exists when a later candle high is below an earlier candle low.

Do not call every small movement BOS or CHoCH.
If confirmation is incomplete, say WAIT.

Return:
MARKET BIAS:
CURRENT PRICE:
BUY-SIDE LIQUIDITY:
SELL-SIDE LIQUIDITY:
LIQUIDITY SWEEP:
SWEEP DIRECTION:
DISPLACEMENT:
CHoCH / MSS:
BOS:
FVG:
ORDER BLOCK:
SMC DECISION:
REASON:
`;

    const user = `
Chart: ${chart.symbol}
Timeframe: ${chart.timeframe}
Current price: ${chart.currentPrice}

User request:
${message}

ACTUAL OHLCV:
Index | Time | Open | High | Low | Close | Volume
${rows}
`;

    const result = await context.env.AI.run(
      "@cf/meta/llama-3.1-8b-instruct",
      {
        messages:[
          {role:"system",content:system},
          {role:"user",content:user}
        ],
        max_tokens:1800,
        temperature:0.1
      }
    );

    return Response.json({
      answer: result?.response || JSON.stringify(result),
      chartAccess:true,
      symbol:chart.symbol,
      timeframe:chart.timeframe,
      candleCount:chart.candles.length
    });

  } catch (e) {
    return Response.json({error:e.message || "AI request failed."},{status:500});
  }
}
