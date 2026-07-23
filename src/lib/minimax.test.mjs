// 单元测试：验证 MiniMax 2026 改版后的 API 字段处理
// 关键点：current_interval_remaining_percent 取代 absolute count 成为权威字段
import { buildUsageViewModel, buildErrorViewModel, resolvePlanInfo } from "./minimax.ts";

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

// =====================================================
// 套餐信息测试（plan 提取）
// =====================================================

// 1) 顶层字段 explicit
{
  const p = resolvePlanInfo(
    { current_subscribe_title: "Plus 月度套餐" },
    { current_interval_total_count: 1500 }
  );
  assert(p.tier === "Plus", "plan: 顶层 current_subscribe_title → Plus");
  assert(p.source === "explicit", "plan: source = explicit");
  assert(p.priceLabel === "¥49 / 月", `plan: priceLabel 是 ¥49 / 月，实际是 ${p.priceLabel}`);
}

// 2) 顶层字段 plan_name 用 Max
{
  const p = resolvePlanInfo(
    { plan_name: "Max" },
    { current_interval_total_count: 4500 }
  );
  assert(p.tier === "Max", "plan: plan_name=Max → Max");
}

// 3) Ultra 显式
{
  const p = resolvePlanInfo(
    { plan: "ultra-pro" },
    { current_interval_total_count: 15000 }
  );
  assert(p.tier === "Ultra", "plan: plan='ultra-pro' → Ultra");
}

// 4) 反推：5h 总额度 = 1500 → Plus
{
  const p = resolvePlanInfo(
    {},
    { current_interval_total_count: 1500 }
  );
  assert(p.tier === "Plus", "plan: 5h=1500 → Plus（反推）");
  assert(p.source === "inferred", "plan: source = inferred");
}

// 5) 反推：5h 总额度 = 4500 → Max
{
  const p = resolvePlanInfo(
    {},
    { current_interval_total_count: 4500 }
  );
  assert(p.tier === "Max", "plan: 5h=4500 → Max（反推）");
}

// 6) 反推：5h 总额度 = 15000 → Ultra
{
  const p = resolvePlanInfo(
    {},
    { current_interval_total_count: 15000 }
  );
  assert(p.tier === "Ultra", "plan: 5h=15000 → Ultra");
}

// 7) 反推：取最大 model total（避免 general=0 干扰）
{
  const p = resolvePlanInfo(
    {},
    // primary total=0，但 model_remains 里 video=5
    { current_interval_total_count: 0 }
  );
  // 注：仅 primary 时的 fallback，maxTotal 仍可能是 0；这种情况下应该是 unknown
  assert(p.source === "unknown", `plan: 单 primary total=0 + 无 payload.model_remains → unknown，实际是 ${p.source}`);
}

// 8) 反推：model_remains 有多个，最大值生效
{
  const p = resolvePlanInfo(
    {
      model_remains: [
        { current_interval_total_count: 0 },
        { current_interval_total_count: 1500 },
        { current_interval_total_count: 800 },
      ],
    },
    { current_interval_total_count: 0 }
  );
  assert(p.tier === "Plus", "plan: max(0,1500,800)=1500 → Plus");
}

// 9) 未知额度
{
  const p = resolvePlanInfo({}, null);
  assert(p.tier === null, "plan: 无数据 → tier null");
  assert(p.source === "unknown", "plan: source = unknown");
}

// 10) 完全没字段
{
  const p = resolvePlanInfo(null, null);
  assert(p.tier === null, "plan: null 输入 → null");
}

// 11) raw 字段名不规范化（custom 企业版）
{
  const p = resolvePlanInfo(
    { current_subscribe_title: "Enterprise Custom" },
    {}
  );
  assert(p.tier === "Custom", "plan: Enterprise Custom → Custom");
}

// 12) buildUsageViewModel 整体测试：用户真实数据 + plan explicit
{
  const payload = {
    base_resp: { status_code: 0, status_msg: "success" },
    current_subscribe_title: "Max",
    model_remains: [
      {
        model_name: "general",
        current_interval_remaining_percent: 83,
        current_interval_total_count: 0,
        current_interval_usage_count: 0,
      },
      {
        model_name: "video",
        current_interval_total_count: 5,
        current_interval_usage_count: 5,
        current_interval_remaining_percent: 100,
      },
    ],
  };
  const vm = buildUsageViewModel(payload, true, "查询成功");
  assert(vm.plan !== null, "buildUsageViewModel: plan 不为 null");
  assert(vm.plan?.tier === "Max", `plan: tier = Max，实际是 ${vm.plan?.tier}`);
  assert(vm.plan?.source === "explicit", "plan: source = explicit");
}

// 13) buildUsageViewModel + plan inferred
{
  const payload = {
    base_resp: { status_code: 0, status_msg: "success" },
    model_remains: [
      {
        model_name: "general",
        current_interval_total_count: 4500, // 5h 总量
        current_interval_usage_count: 3000, // 剩余
        current_interval_remaining_percent: 67,
      },
    ],
  };
  const vm = buildUsageViewModel(payload, true, "查询成功");
  assert(vm.plan?.tier === "Max", "plan inferred: 4500 → Max");
  assert(vm.plan?.source === "inferred", "plan inferred: source = inferred");
}

// =====================================================
// 场景 1：用户真实 API 返回（general + video）
// 关键：general 模型 absolute count 是 0/0，但有 remaining_percent=83
//       video 模型两个都有
// 主卡应该选 general（因为有 percent），显示 17% 已用
// =====================================================
const userRealPayload = {
  base_resp: { status_code: 0, status_msg: "success" },
  model_remains: [
    {
      model_name: "general",
      start_time: 1784563200000,
      end_time: 1784581200000,
      remains_time: 3589890,
      current_interval_total_count: 0,
      current_interval_usage_count: 0,
      current_weekly_total_count: 0,
      current_weekly_usage_count: 0,
      weekly_start_time: 1784476800000,
      weekly_end_time: 1785081600000,
      weekly_remains_time: 503989890,
      current_interval_status: 1,
      current_interval_remaining_percent: 83,
      current_weekly_status: 3,
      current_weekly_remaining_percent: 100,
    },
    {
      model_name: "video",
      start_time: 1784563200000,
      end_time: 1784649600000,
      remains_time: 71989890,
      current_interval_total_count: 5,
      current_interval_usage_count: 5,
      current_weekly_total_count: 35,
      current_weekly_usage_count: 35,
      weekly_start_time: 1784476800000,
      weekly_end_time: 1785081600000,
      weekly_remains_time: 503989890,
      current_interval_status: 1,
      current_interval_remaining_percent: 100,
      current_weekly_status: 1,
      current_weekly_remaining_percent: 100,
    },
  ],
};

const vmUser = buildUsageViewModel(userRealPayload, true, "查询成功");
assert(vmUser.ok === true, "用户场景：ok = true");
assert(
  vmUser.primaryModelName === "general",
  `用户场景：primary 应该是 general（有 percent 字段），实际是 "${vmUser.primaryModelName}"`
);
assert(
  vmUser.remainingPercent === 83,
  `用户场景：remainingPercent = 83，实际是 ${vmUser.remainingPercent}`
);
assert(
  vmUser.usedPercent === 17,
  `用户场景：usedPercent = 100-83 = 17，实际是 ${vmUser.usedPercent}`
);
assert(
  vmUser.weeklyRemainingPercent === 100,
  `用户场景：weekly remaining = 100，实际是 ${vmUser.weeklyRemainingPercent}`
);
assert(
  vmUser.weeklyUsedPercent === 0,
  `用户场景：weekly used = 0，实际是 ${vmUser.weeklyUsedPercent}`
);
assert(
  vmUser.models.length === 2,
  `用户场景：模型列表保留 2 个（general 和 video 都过滤保留），实际是 ${vmUser.models.length}`
);

// video 卡片：absolute 5/5，percent 100%（剩余）
const videoCard = vmUser.models.find((m) => m.name === "video");
assert(
  videoCard && videoCard.totalCount === 5,
  `video：totalCount = 5，实际是 ${videoCard?.totalCount}`
);
assert(
  videoCard && videoCard.remainingCount === 5,
  `video：remainingCount = 5（=usage_count，按"剩余"语义），实际是 ${videoCard?.remainingCount}`
);
assert(
  videoCard && videoCard.usedPercent === 0,
  `video：usedPercent = 0（剩余 100%），实际是 ${videoCard?.usedPercent}`
);
assert(
  videoCard && videoCard.remainingPercent === 100,
  `video：remainingPercent = 100，实际是 ${videoCard?.remainingPercent}`
);

// general 卡片：absolute 都是 0（不应展示为数字），percent 83
const generalCard = vmUser.models.find((m) => m.name === "general");
assert(
  generalCard && generalCard.totalCount === null,
  `general：totalCount 应为 null（API 返回 0），实际是 ${generalCard?.totalCount}`
);
assert(
  generalCard && generalCard.usedCount === null,
  `general：usedCount 应为 null（没 absolute 数据），实际是 ${generalCard?.usedCount}`
);
assert(
  generalCard && generalCard.remainingPercent === 83,
  `general：remainingPercent = 83，实际是 ${generalCard?.remainingPercent}`
);
assert(
  generalCard && generalCard.usedPercent === 17,
  `general：usedPercent = 17，实际是 ${generalCard?.usedPercent}`
);

// =====================================================
// 场景 2：纯 percent 模型（兼容测试）
// =====================================================
const percentOnly = {
  base_resp: { status_code: 0, status_msg: "success" },
  model_remains: [
    {
      model_name: "MiniMax-Text",
      current_interval_remaining_percent: 60,
      current_weekly_remaining_percent: 90,
    },
  ],
};
const vm2 = buildUsageViewModel(percentOnly, true, "查询成功");
assert(vm2.remainingPercent === 60, "场景2：remaining 60%");
assert(vm2.usedPercent === 40, "场景2：used 40%");
assert(vm2.weeklyRemainingPercent === 90, "场景2：weekly remaining 90%");
assert(vm2.weeklyUsedPercent === 10, "场景2：weekly used 10%");

// =====================================================
// 场景 3：纯绝对数字模型（用户给的 extractor 公式）
// =====================================================
const absoluteOnly = {
  base_resp: { status_code: 0, status_msg: "success" },
  model_remains: [
    {
      model_name: "MiniMax-M2.7",
      current_interval_total_count: 100,
      current_interval_usage_count: 85, // 剩余
    },
  ],
};
const vm3 = buildUsageViewModel(absoluteOnly, true, "查询成功");
assert(vm3.totalCount === 100, "场景3：total = 100");
assert(vm3.remainingCount === 85, "场景3：remaining = 85（=usage_count）");
assert(vm3.usedCount === 15, "场景3：used = total - remaining = 15");
assert(vm3.usedPercent === 15, "场景3：used% = 15%");

// =====================================================
// 场景 4：percent + count 都有的情况，percent 优先
// =====================================================
const both = {
  base_resp: { status_code: 0, status_msg: "success" },
  model_remains: [
    {
      model_name: "MiniMax-M2.7",
      current_interval_total_count: 100,
      current_interval_usage_count: 50, // 剩余
      current_interval_remaining_percent: 70, // percent 是更权威来源
    },
  ],
};
const vm4 = buildUsageViewModel(both, true, "查询成功");
assert(vm4.totalCount === 100, "场景4：total = 100");
assert(vm4.usedPercent === 30, "场景4：used% 应来自 percent (100-70=30)，不是 count 算出的 50%");
assert(vm4.remainingPercent === 70, "场景4：remainingPercent = 70");

// =====================================================
// 场景 5：完全空数据
// =====================================================
const empty = {
  base_resp: { status_code: 0, status_msg: "success" },
  model_remains: [],
};
const vm5 = buildUsageViewModel(empty, true, "查询成功");
assert(vm5.ok === true, "场景5：空数组 ok=true");
assert(vm5.primaryModelName === "", "场景5：primary 为空");

// =====================================================
// 场景 6：API Key 错误（1004）
// =====================================================
const errPayload = {
  base_resp: { status_code: 1004, status_msg: "invalid api key" },
};
const errVm = buildUsageViewModel(errPayload, false, "请检查 API Key", errPayload);
assert(errVm.ok === false, "场景6：1004 状态码 ok=false");

// =====================================================
// 场景 7：buildErrorViewModel 形状
// =====================================================
const e2 = buildErrorViewModel("测试错误", { foo: 1 });
assert(e2.ok === false, "场景7：错误 VM ok=false");
assert(e2.remainingPercent === null, "场景7：错误 VM remainingPercent=null");

// =====================================================
// 场景 8：percent=0（边界：完全没用）
// =====================================================
const zeroPercent = {
  base_resp: { status_code: 0, status_msg: "success" },
  model_remains: [
    { model_name: "MiniMax-M2.7", current_interval_remaining_percent: 100 },
  ],
};
const vm8 = buildUsageViewModel(zeroPercent, true, "查询成功");
assert(vm8.usedPercent === 0, "场景8：100% remaining → used 0%");
assert(vm8.remainingPercent === 100, "场景8：remaining 100%");

// =====================================================
// 场景 9：percent=0（边界：完全耗尽）
// =====================================================
const exhausted = {
  base_resp: { status_code: 0, status_msg: "success" },
  model_remains: [
    { model_name: "MiniMax-M2.7", current_interval_remaining_percent: 0 },
  ],
};
const vm9 = buildUsageViewModel(exhausted, true, "查询成功");
assert(vm9.usedPercent === 100, "场景9：0% remaining → used 100%");

console.log(`\n${fail === 0 ? "🎉 全部通过" : `❌ ${fail} 个失败`} (${pass} 通过 / ${fail} 失败)`);