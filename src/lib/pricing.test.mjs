// 单元测试：pricing 模块
import {
  estimateCost,
  formatCNY,
  formatUSD,
  formatTokens,
  usdToCny,
  sumLastNDays,
  parseBigCount,
  MODEL_PRICING,
  DEFAULT_INPUT_RATIO,
} from "./pricing.ts";

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("❌", msg);
    fail++;
    process.exitCode = 1;
  } else {
    console.log("✅", msg);
    pass++;
  }
}

// 1) estimateCost basic
{
  // 1M tokens total, 20% input / 80% output
  // GPT-4o: 0.2 * 1 * 2.5 + 0.8 * 1 * 10.0 = 0.5 + 8.0 = 8.5
  const c = estimateCost(1e6, {
    id: "test",
    provider: "Test",
    model: "Test",
    inputPerMillion: 2.5,
    outputPerMillion: 10,
  });
  assert(Math.abs(c - 8.5) < 0.001, `estimateCost 1M GPT-4o 比例 20/80 = $8.5，实际是 $${c.toFixed(4)}`);
}

// 2) estimateCost with 0 tokens → 0
{
  const c = estimateCost(0, MODEL_PRICING[0]);
  assert(c === 0, "estimateCost(0) = 0");
}

// 3) estimateCost DeepSeek-V3 100M total → 0.2 * 100 * 0.14 + 0.8 * 100 * 0.28 = 2.8 + 22.4 = 25.2
{
  const c = estimateCost(100e6, MODEL_PRICING[0]); // DeepSeek-V3
  assert(Math.abs(c - 25.2) < 0.01, `DeepSeek-V3 100M = $25.20，实际 $${c.toFixed(2)}`);
}

// 4) formatCNY / formatUSD 各档位（formatUSD 内部已换算成 CNY）
{
  // formatCNY 直接输入人民币
  assert(formatCNY(0) === "¥0", "formatCNY(0) = ¥0");
  assert(formatCNY(533.13) === "¥533.13", "formatCNY(533.13) = ¥533.13");
  assert(formatCNY(5500) === "¥5,500", "formatCNY(5500) = ¥5,500");
  assert(formatCNY(15000) === "¥1.50 万", "formatCNY(15000) = ¥1.50 万");
  assert(formatCNY(1.5e7) === "¥1500 万", "formatCNY(1.5e7) = ¥1500 万");
  assert(formatCNY(1.5e9).endsWith("亿"), "formatCNY(1.5B) ends with 亿");

  // formatUSD 把美元换算成人民币展示
  assert(formatUSD(0) === "¥0", "formatUSD(0) = ¥0");
  assert(formatUSD(0.5).startsWith("¥"), "formatUSD(0.5) starts with ¥");
  assert(formatUSD(2.5).startsWith("¥"), "formatUSD(2.5) starts with ¥");
  // usdToCny
  assert(usdToCny(100) === 720, "usdToCny(100) = 720（7.2 汇率）");
  assert(usdToCny(0) === 0, "usdToCny(0) = 0");
}

// 5) formatTokens
{
  assert(formatTokens(0) === "0", "formatTokens(0) = 0");
  assert(formatTokens(500) === "500", "formatTokens(500) = 500");
  assert(formatTokens(1500) === "1.5K", "formatTokens(1500) = 1.5K");
  assert(formatTokens(2.5e6) === "2.50M", "formatTokens(2.5M) = 2.50M");
  assert(formatTokens(17.7e9).endsWith("B"), `formatTokens(17.7B) ends with B`);
}

// 6) sumLastNDays
{
  const arr = [1, 2, 3, 4, 5];
  assert(sumLastNDays(arr, 3) === 3 + 4 + 5, "sumLastNDays(arr, 3) = 12");
  assert(sumLastNDays(arr, 100) === 1 + 2 + 3 + 4 + 5, "sumLastNDays(arr, 100) = 15（不会超出）");
  assert(sumLastNDays(undefined, 7) === 0, "sumLastNDays(undefined) = 0");
  assert(sumLastNDays([], 7) === 0, "sumLastNDays([]) = 0");
}

// 7) parseBigCount
{
  assert(parseBigCount("17.70B") === 17.7e9, `parseBigCount("17.70B") = 17.7B`);
  assert(parseBigCount("990.54M") === 990.54e6, `parseBigCount("990.54M") = 990M`);
  assert(parseBigCount("1.5K") === 1500, `parseBigCount("1.5K") = 1500`);
  assert(parseBigCount("100") === 100, `parseBigCount("100") = 100`);
  assert(parseBigCount(undefined) === 0, "parseBigCount(undefined) = 0");
}

// 8) MODEL_PRICING 数据完整性
{
  assert(MODEL_PRICING.length === 8, `MODEL_PRICING 有 8 个模型，实际 ${MODEL_PRICING.length}`);
  for (const m of MODEL_PRICING) {
    assert(m.inputPerMillion > 0, `${m.model}: inputPerMillion > 0`);
    assert(m.outputPerMillion > 0, `${m.model}: outputPerMillion > 0`);
  }
}

// 9) DEFAULT_INPUT_RATIO 是 0.2
{
  assert(DEFAULT_INPUT_RATIO === 0.2, `DEFAULT_INPUT_RATIO = 0.2，实际是 ${DEFAULT_INPUT_RATIO}`);
}

// 10) 完整业务场景
// 假设用户 17.70B 累计 tokens：按 DeepSeek V3 价格 = ?
{
  const total = parseBigCount("17.70B");
  // 0.2 * 17.7e9 / 1e6 * 0.14 + 0.8 * 17.7e9 / 1e6 * 0.28
  // = 4956 + 39648 = $4460.4
  const c = estimateCost(total, MODEL_PRICING[0]);
  // 注意：DeepSeek-V3 17.70B tokens 是天量，实际不太可能——但算出来应是数千美元级别
  assert(c > 1000, `17.70B tokens 按 DeepSeek V3 算 > $1000（$=${c.toFixed(2)}）`);
  assert(c < 100000, `17.70B tokens 按 DeepSeek V3 算 < $100k（$=${c.toFixed(2)}）`);
}

console.log(`\n${fail === 0 ? "🎉 全部通过" : `❌ ${fail} 个失败`} (${pass} 通过 / ${fail} 失败)`);