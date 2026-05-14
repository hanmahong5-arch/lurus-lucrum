import Link from "next/link";
import {
  PLAN_DISPLAY,
  getLimitsForPlan,
  type PlanTier,
} from "@/lib/config/plan-limits";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";

export const metadata = {
  title: "订阅方案 — Lurus 量化",
  description:
    "AI 策略生成 + 历史回测 + 多 Agent 投资顾问 — 4 档订阅方案,从体验到机构按节奏升级。",
};

const FEATURES: ReadonlyArray<{
  label: string;
  get: (t: PlanTier) => string;
}> = [
  {
    label: "AI 策略生成",
    get: (t) => {
      const v = getLimitsForPlan(t).dailyAiCalls;
      return v === Infinity ? "无限" : `${v} 次/天`;
    },
  },
  {
    label: "单股回测",
    get: (t) => {
      const v = getLimitsForPlan(t).dailyBacktests;
      return v === Infinity ? "无限" : `${v} 次/天`;
    },
  },
  {
    label: "历史数据",
    get: (t) => {
      const v = getLimitsForPlan(t).historyYears;
      return v === Infinity ? "全量" : `近 ${v} 年`;
    },
  },
  {
    label: "多股验证",
    get: (t) => {
      const v = getLimitsForPlan(t).maxMultiStocks;
      if (v === 0) return "—";
      if (v === Infinity) return "无限";
      return `${v} 只/次`;
    },
  },
  {
    label: "AI 投资顾问",
    get: (t) => {
      const m = getLimitsForPlan(t).advisorMode;
      if (m === "none") return "—";
      if (m === "single") return "基础模式";
      return "完整版 (11 Agent + 辩论)";
    },
  },
];

function ctaFor(code: PlanTier): { href: string; label: string } {
  if (code === "enterprise") {
    return {
      href: "mailto:hello@lurus.cn?subject=Lurus%20Enterprise%20Inquiry",
      label: "联系商务",
    };
  }
  if (code === "free") {
    return { href: "/auth/register", label: "免费开始" };
  }
  const callback = encodeURIComponent(
    `/dashboard/account?upgrade=${code}`,
  );
  return {
    href: `/auth/login?callbackUrl=${callback}`,
    label: "升级解锁",
  };
}

export default function PricingPage() {
  return (
    <main className="min-h-screen">
      <Header />

      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
            选择适合你的方案
          </h1>
          <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
            从体验到机构,按节奏升级 · 所有方案随时升级 · 包年享约 20% 优惠
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLAN_DISPLAY.map((plan) => {
            const cta = ctaFor(plan.code);
            return (
              <div
                key={plan.code}
                className={`relative rounded-2xl p-6 border transition-colors ${
                  plan.highlighted
                    ? "border-primary bg-primary/[0.04]"
                    : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-medium text-white bg-primary rounded-full">
                    推荐
                  </div>
                )}

                <div className="text-3xl mb-3" aria-hidden>
                  {plan.icon}
                </div>
                <h2 className="text-xl font-bold text-white">{plan.nameEn}</h2>
                <p className="text-sm text-neutral-500 mb-6 min-h-[2.5rem]">
                  {plan.tagline}
                </p>

                <div className="mb-6 min-h-[4rem]">
                  {plan.priceMonthly < 0 ? (
                    <span className="text-2xl font-bold text-white">
                      商务定价
                    </span>
                  ) : plan.priceMonthly === 0 ? (
                    <span className="text-3xl font-mono tabular-nums font-bold text-white">
                      免费
                    </span>
                  ) : (
                    <>
                      <span className="text-4xl font-mono tabular-nums font-bold text-white">
                        ¥{plan.priceMonthly}
                      </span>
                      <span className="text-neutral-500"> / 月</span>
                    </>
                  )}
                </div>

                <ul className="space-y-2 mb-8 min-h-[180px]">
                  {FEATURES.map((f) => (
                    <li
                      key={f.label}
                      className="text-sm text-neutral-400 flex items-start"
                    >
                      <span className="text-emerald-400 mr-2 mt-0.5 flex-shrink-0">
                        ✓
                      </span>
                      <span>
                        <span className="text-neutral-500">{f.label}: </span>
                        <span className="text-neutral-300">
                          {f.get(plan.code)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={cta.href}
                  className={`block w-full text-center py-3 rounded-lg font-medium btn-tactile transition-colors ${
                    plan.highlighted
                      ? "bg-primary text-white hover:bg-primary-600"
                      : "border border-white/20 text-white hover:bg-white/[0.05]"
                  }`}
                >
                  {cta.label}
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mt-20 max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-4">常见问题</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
            <div>
              <h3 className="text-base font-medium text-white mb-2">
                如何取消订阅?
              </h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                登录后在
                <Link
                  href="/dashboard/account"
                  className="text-primary hover:underline mx-1"
                >
                  账户设置
                </Link>
                随时取消,本期到期后不再续费。
              </p>
            </div>
            <div>
              <h3 className="text-base font-medium text-white mb-2">
                支持哪些支付方式?
              </h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                支付宝、微信、企业转账。机构方案支持发票。
              </p>
            </div>
            <div>
              <h3 className="text-base font-medium text-white mb-2">
                可以先免费试用吗?
              </h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                可以,Explorer 永久免费,包含每日 3 次 AI 生成 + 5 次回测,足够验证产品价值后再升级。
              </p>
            </div>
            <div>
              <h3 className="text-base font-medium text-white mb-2">
                数据安全吗?
              </h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                所有策略代码加密存储,不分享给其他用户。机构方案支持私有部署。
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
