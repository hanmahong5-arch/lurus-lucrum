# 中国量化交易平台竞品分析报告 / Competitive Analysis: Chinese Quant Trading Platforms

> Date: 2026-03-16
> Purpose: Competitive intelligence for Lurus Lucrum product positioning

---

## Executive Summary

中国散户量化交易市场正处于从"程序员专属工具"向"大众化投资工具"转型的关键阶段。核心矛盾在于：中国拥有近2亿散户投资者，但量化交易渗透率不足10%（美国>70%）。主要原因是编程门槛高、数据贵、实盘接入难。

The market is shifting from programmer-only tools toward mass-market investment platforms. Key opportunity: ~200M retail investors in China, but <10% quant penetration vs >70% in the US. Main barriers: coding requirements, expensive data, and difficult live trading access.

---

## 1. 聚宽 JoinQuant (joinquant.com)

### Overview
- Founded: 2015, received ~100M RMB Series B from Baidu (2017)
- Positioning: 国内最知名的量化投研平台，以社区和教育为核心
- Language: Python
- Data: A股、期货、期权、基金、宏观数据，数百个因子

### Pricing
| Tier | Price | Key Features |
|------|-------|--------------|
| Free | 0 | 基础回测、100万条/天数据流量、量化课堂 |
| JQData 正式版 | ~数百元/月(估) | 2亿条/天数据、Alpha因子、Tick数据、百度因子 |
| JQData 专业版 | 更高(面议) | 机构级数据服务 |
| 金融终端(本地) | Free | 本地化运行、策略保密、Python扩展自由安装 |

### Onboarding & Learning
- **量化课堂**: 100+ structured courses, from basics to advanced models
- Target: "让高中生都能学会" (accessible to high school students)
- Path: API文档 → 社区干货帖 → 交流群 → 实战策略
- GitHub上有第三方整理的学习文档

### Key Differentiators
- 最强的中文量化教育体系（100+课程）
- 社区最活跃（策略精选、擂台赛）
- 低频回测效率最高（128秒 benchmark）
- API文档质量公认优秀
- 策略商城（可卖策略）

### Critical Weakness
- **2023年12月实盘通道关闭**：一创聚宽终止所有服务，至今无直接实盘途径
- 存量策略集体"瘫痪"，用户被迫迁移至QMT/PTrade
- 数据免费额度逐渐减少，后期不够用

### Community & Social
- 策略精选展示收益指标
- 策略擂台赛
- QQ群活跃交流
- 社区干货帖持续更新

### Mobile: 无专用移动端

---

## 2. 优矿 Uqer (uqer.datayes.com)

### Overview
- Operator: 通联数据(DataYes)
- Positioning: 华尔街级量化投研装备，面向专业投资者
- Language: Python (IPython Notebook environment)

### Pricing
| Tier | Price | Key Features |
|------|-------|--------------|
| Free | 0 | 基础研究回测、部分数据 |
| Pro | 面议(To B) | 全数据、机构级服务 |

### Key Differentiators
- 自研风险模型 + 投资组合优化器(uqerOptimizer)
- 业绩归因分析工具
- 深度研究报告（金工团队每周两篇）
- 数据覆盖：2007年至今沪深港财务/行情/因子

### Weaknesses
- **社区活跃度大幅下降**（近年冷清）
- 数据下载限额减少
- 个人用户功能有限，主要面向B端
- 盈利模式转向机构市场

### Onboarding
- 量化学堂板块
- Jupyter Notebook 风格研究环境
- 适合有Python基础的用户

### Mobile: 无

---

## 3. 米筐 RiceQuant (ricequant.com)

### Overview
- Founded: 2014, by ex-HK investment bank trader
- Funding: $1M Angel (Source Code Capital, 2014), 25M RMB Series A (2016)
- Positioning: 视觉设计最优的量化平台
- Languages: Python, Java, R
- Users: 37,000+ (2016 data)

### Pricing
| Tier | Price | Key Features |
|------|-------|--------------|
| C端个人 | Free | 研究、回测、模拟交易 |
| 教育版 | Free(在校师生) | 大部分策略开发功能 |
| B端机构 | 30万+/年 | 本地部署、全功能 |

### Key Differentiators
- **视觉设计公认最佳**（回测结果页面美观）
- 开源框架 RQAlpha 2.0（可本地运行）
- RQSDK 本地套件（RQData + RQAlpha Plus + RQFactor + RQOptimizer）
- `pip install rqsdk` 一行命令搭建环境
- 数据源：恒生聚源、万得、巨灵等5家互补

### Weaknesses
- 个人用户无法直接接实盘交易（需申请人工审核）
- 网络连接不稳定时接口容易断
- 早期RQPro客户端安装包~1GB（后通过RQSDK改善）
- 功能推出速度较慢

### Onboarding
- 文档质量高、设计好
- QQ群24小时答疑（创始人亲自参与）
- 社区量化比赛（实盘资金投入）

### Community
- 量化比赛（持续举办）
- 社区活跃度较高

### Mobile: 无

---

## 4. 掘金量化 Myquant (myquant.cn)

### Overview
- Positioning: 专业落地式量化终端，策略本地运行
- Languages: **Python, Matlab, C++, C#** (4种，最多)
- Focus: 从研究到实盘的全流程

### Pricing
| Tier | Price | Key Features |
|------|-------|--------------|
| Free | 0 | 基本投研、数据、回测、仿真 |
| Pro | 9,800元/年 | 专业回测、高级数据 |
| 券商版 | 由券商定价 | 实盘通道、掘金不收费 |
| 机构版 | 定制(面议) | 不面向个人 |

### Key Differentiators
- **本地化终端**：策略在本地运行，最大程度保护策略安全
- 多语言支持（4种编程语言）
- 仿真交易高度仿真（手续费模型精确到方向/交易额/手数）
- 回测性能提升20-50倍（3.17版本）
- 绩效分析报告可下载PDF
- 智能工具：网格交易、自动逆回购、打板工具、组合交易（篮子交易）
- 增值服务：策略代写、技术支持、资金与策略对接

### Weaknesses
- 必须开启本地Windows客户端 + 联网
- 依赖Windows DLL，无法云端部署
- 客户端代码结构不友好（以token命名工作路径）
- 社区不太活跃
- Tick数据只能回测近5个交易日
- 资金流数据收费，免费数据偏少
- 文档不够完善

### Onboarding
- 5分钟上手指引
- 30分钟策略入门指引
- SDK安装后即可开始

### Mobile: 无

---

## 5. 果仁网 Guorn (guorn.com)

### Overview
- Founded: 2015
- Founders: 清华大学计算机系毕业，ex-MicroStrategy核心开发
- Positioning: **零编程门槛的量化投资平台** — 最重要的差异化

### Pricing
| Tier | Price | Key Features |
|------|-------|--------------|
| 免费研究用户 | 0 | 基础回测、1000计算点/天、10个选股条件 |
| VIP | 1,080元/年 | 微信推送、自定义指标、数据导出、5000计算点/天、30个选股条件、2007年起数据 |
| 至尊用户 | 6,998元/年 | 全功能、多计算进程、优先客服、20000计算点/天、实时回测、AI助手、港股持仓数据、120次智能优化 |

### Key Differentiators (Critical for Lucrum reference)
- **完全无需编程**：向导式、菜单界面、拖拽鼠标完成选股
- 海量A股因子库，筛选+排名组合选股
- 通达信/大智慧用户学习零门槛
- **策略商城（达人跟投）**：80+认证策略 + 5个策略组合 + ~15,000共享策略
- 策略出租：作者自定价格
- 程序化交易 + 自动调仓
- 自动盯盘 + 条件下单
- 大盘择时、股指对冲

### UX Flow (How non-programmers use it)
1. 选择因子指标（从海量因子库）
2. 设置筛选条件（市盈率<20，ROE>15%等）
3. 设置排名条件（对候选股按指标排序）
4. 配置交易模型（买卖条件、个股仓位、调仓周期）
5. 一键回测 → 查看历史表现
6. 可选：开启自动调仓/自动盯盘
7. 可选：在策略商城出租或跟随达人策略

### Weaknesses
- 策略灵活度受限（无法编程实现复杂逻辑）
- 专业量化投资者觉得功能不够用
- 仅覆盖A股和ETF
- 社区规模相对较小

### Mobile: 部分功能可通过微信推送接收调仓信号

---

## 6. BigQuant (bigquant.com)

### Overview
- 关联公司: 宽邦科技
- Positioning: **AI + 量化** 的先驱平台
- Core Algorithm: StockRanker (list-wise排序学习)

### Pricing
| Tier | Price | Key Features |
|------|-------|--------------|
| Free | 0 | 基础数据、AI算法、回测、模拟 |
| Standard | 129元/月 | 模拟交易服务器3个(1C/6G)、回测资源(2C/8G)、10GB存储 |
| Flagship | 659元/月 | 标准版全部 + 实时交易服务器2个(1C/6G)、50GB存储 |

### Key Differentiators
- **三种策略开发模式**：代码模式 / 生成器模式 / 可视化拖拽模式
- StockRanker：AI选股排序算法（list-wise learning, 20棵决策树）
- 2000+ 基础因子库 + AI衍生因子挖掘
- 全面支持主流AI框架（TensorFlow, PyTorch等）
- PB级金融数据 + 新型投资大数据
- 覆盖A股、美股、港股、期货、期权

### AI Feature Details
- StockRanker: 输入多因子 → 训练排序模型 → 输出全市场股票排名
- 自动机器学习、超参优化
- 用户拖拽模块即可构建AI策略，无需理解AI理论
- "传统量化团队1-4周即可熟练使用BigQuant开发AI策略"

### Weaknesses
- **实盘表现差**：社区AI策略回测曲线90度向上，实盘回撤30%+
- 定位偏差：面向散户而非专业量化
- "可视化功能更多是锦上添花"（用户评价）
- 月费制相对较贵

### Community
- 量化策略大赛
- Wiki知识库
- Quant成长体系

### Mobile: 无

---

## 7. 同花顺 (10jqka.com) — i问财 + SuperMind

### Overview
同花顺是中国最大的金融信息服务商之一，量化产品分为两条线：
- **i问财**: 自然语言AI选股（面向普通散户）
- **SuperMind**: 专业量化投研+实盘平台（面向有编程能力的用户）

### i问财 Pricing
| Tier | Price | Key Features |
|------|-------|--------------|
| Free | 0 | 基础自然语言选股、简单回测 |
| 专业版 | 298-518元/季 | 500字长问句、200次/天数据导出、130+特色指标、AI精选策略 |

### SuperMind Pricing
| Tier | Price | Key Features |
|------|-------|--------------|
| 网页端(Free) | 0 | 回测(秒级)、研究环境、因子研究、模拟交易、全量金融数据 |
| 本地客户端/SDK | 付费(具体面议) | 仿真交易、实盘交易、本地SDK |
| 实盘 | 50万资金门槛 | 实盘交易权限 |

### Key Differentiators
- **i问财：自然语言选股** — "市盈率低于20且营收增长超过10%的股票"
  - R1级深度推理 + 专业投研工具
  - AI事件预测、热点解读
  - 技术面/行情面/基本面/财务面多维度
- **SuperMind: 秒级回测** — 300股4年日频回测仅0.29秒
  - 不绑定券商、无资金门槛(网页端)
  - 极低交易延时(10ms~100ms)
  - 支持问财自然语言接口
  - Tick级别数据免费
  - 多品种：股票、期货期权、可转债、外汇、场外基金

### Weaknesses
- 实盘需50万资金门槛
- 高级功能收费较贵
- SuperMind 生态不如聚宽社区活跃
- 机构定制方案价格不透明

### Mobile: i问财有独立App（AI选股）

---

## 8. 东方财富 Choice (choice.eastmoney.com)

### Overview
- 东方财富是中国最大的个人金融信息门户
- Choice：专业金融终端（类Bloomberg/Wind定位）
- EMQuant：量化数据接口

### Pricing
| Tier | Price | Key Features |
|------|-------|--------------|
| Choice量化接口 | ~30,000元/年 | 全品种数据、Python/Matlab/C++/C#接口、策略回测 |
| 东方财富量化(掘金合作版) | 券商开户后使用 | 策略开发、回测、仿真、实盘 |

### Key Differentiators
- 数据质量行业顶级（券商做报告标配）
- 覆盖最全：股票/期货/期权/基金/债券/宏观
- Windows + Linux 跨平台支持
- 与掘金量化合作推出东财掘金平台

### Weaknesses
- **价格极高**（~3万/年），散户难以承受
- 纯数据接口，不能直接交易
- 需额外对接交易系统
- 用户反馈"费用昂贵，还不好用"

### Mobile: 东方财富App（行情为主，非量化）

---

## 9. 券商量化平台补充：QMT & PTrade

虽然不在原始清单中，但这两个平台是当前散户实盘量化的实际主力。

### QMT (迅投)
- **Free** (通过券商开户，资金门槛30-100万)
- 毫秒级交易延迟(<1ms)、跨市场跨品种
- 本地运行，功能强大
- 缺点：上手难、必须保持开机、资料少

### PTrade (恒生电子)
- **Free** (通过券商开户)
- 云端托管（无需本地运行）
- API类聚宽，编程友好
- 缺点：实盘数量有限、回测慢、不开源

---

## Competitive Matrix / 竞品矩阵

| Dimension | 聚宽 | 优矿 | 米筐 | 掘金 | 果仁 | BigQuant | 同花顺 | 东财Choice |
|-----------|------|------|------|------|------|----------|--------|-----------|
| **编程门槛** | Python | Python | Python/Java/R | Python/C++/C#/Matlab | **无需编程** | 可视化拖拽/Python | 自然语言/Python | Python/C++等 |
| **免费回测** | Yes | Yes | Yes | Yes | Yes(受限) | Yes | Yes(秒级) | No(~3万/年) |
| **实盘交易** | **已关闭** | 有限 | 需审核 | 券商版 | 支持 | 付费 | 50万门槛 | 需对接 |
| **AI能力** | 无 | 无 | 无 | 无 | 基础 | **核心卖点** | i问财NLP | 无 |
| **社区活跃** | **最高** | 冷清 | 高 | 一般 | 中等 | 中等 | 一般 | 无 |
| **教育体系** | **100+课程** | 量化学堂 | 文档好 | 快速指引 | 视频教程 | Wiki+社区 | FAQ | 产品手册 |
| **策略安全** | 云端 | 云端 | 云端/本地 | **本地运行** | 云端 | 云端 | 云端/本地SDK | 本地 |
| **移动端** | 无 | 无 | 无 | 无 | 微信推送 | 无 | **i问财App** | 行情App |
| **策略市场** | 策略商城 | 无 | 比赛 | 无 | **达人跟投** | 比赛 | 无 | 无 |
| **月费(入门)** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ~2,500 |
| **月费(进阶)** | ~数百 | 面议 | 面议(B端) | ~817 | ~90 | 129 | ~100-170/月 | ~2,500 |

---

## Common User Complaints (from Zhihu & forums)

### 1. 实盘接入困难
- 聚宽实盘通道2023年关闭，用户集体"瘫痪"
- 米筐实盘需人工审核
- QMT/PTrade需30-100万资金门槛
- "代码写完了但没法真正交易"是最普遍的痛点

### 2. 回测与实盘差距大
- BigQuant的AI策略"回测曲线90度向上，实盘回撤30%+"
- 超高频策略和超大单策略模拟效果失真
- "回测很美好，实盘打骨折"

### 3. 数据限额/收费
- 聚宽免费额度逐渐减少
- 优矿数据下载限额不够用
- 掘金Tick数据只能回测5天，资金流数据收费
- Choice ~3万/年，散户难以承受

### 4. 编程门槛高
- "高门槛、难度大使量化平台过滤掉了绝大多数散户"
- AI辅助编程（Deepseek等）生成的QMT/PTrade代码"基本无法运行"
- 果仁网虽然无需编程，但灵活度又太低

### 5. 平台稳定性
- 米筐网络不稳定
- 掘金必须联网+开Windows客户端
- QMT启动耗资源，数据下载慢
- PTrade消息推送不可靠

### 6. 社区与文档
- 掘金社区不活跃、文档不完善
- 优矿社区冷清
- QMT相关资料匮乏

---

## Industry Trends / 行业趋势

### 1. 低代码/无代码化
- 果仁网、BigQuant可视化模式、i问财自然语言 → 趋势明确
- "未来用户无需学习编程便可进行量化策略搭建的低门槛产品将成为主流"
- 迅动量化等产品将投资过程像"搭积木"一样模块化拆解

### 2. AI Native
- BigQuant率先以AI为核心定位
- 同花顺i问财引入R1级深度推理
- 微软Qlib开源AI量化平台(17.5K GitHub Stars)
- 但AI策略实盘效果仍然是行业难题

### 3. 券商化/实盘化
- 聚宽、米筐、优矿等独立平台均受困于实盘接入
- 趋势转向与券商合作（QMT、PTrade、掘金券商版）
- 独立平台向B端机构转型

### 4. 本地化回归
- 策略安全性是"致命痛点"
- 掘金（本地终端）、RQSDK（pip install）、聚宽金融终端（本地免费）
- 用户越来越不愿把策略放在云端

### 5. 社交交易萌芽
- 果仁网达人策略跟投
- 优宽量化策略出租/出售
- 聚宽策略商城
- 但与海外eToro等成熟社交交易平台差距仍大

---

## Implications for Lurus Lucrum / 对鹿神的启示

### Market Gap Analysis / 市场空白

1. **AI + 无代码 + 实盘 = 空白地带**
   - BigQuant有AI但实盘差、不是无代码
   - 果仁无代码但无AI能力
   - i问财有NLP但实盘门槛50万
   - 没有平台同时做到：AI驱动 + 无代码 + 低门槛实盘

2. **移动端极度匮乏**
   - 几乎所有平台都是PC/Web端
   - 仅i问财有独立App，仅果仁有微信推送
   - 散户的主要操作场景在手机上，这是巨大的未满足需求

3. **社交交易不成熟**
   - 仅果仁有真正的达人跟投体系
   - 策略市场化、策略社区、跟单功能远未成熟
   - 参考海外eToro/Moomoo的社交交易模式

4. **教育与上手体验参差不齐**
   - 聚宽教育最好但无实盘
   - 果仁最易上手但功能有限
   - 缺少"手把手引导+即时反馈"的现代Onboarding体验

### Pricing Strategy Reference / 定价参考

| Segment | Price Range | Model |
|---------|-------------|-------|
| 散户入门 | Free or <100元/月 | Freemium |
| 进阶用户 | 100-800元/月 | Subscription |
| 数据服务 | 按量/按级 | Usage-based |
| 策略市场 | 抽成 | Marketplace |
| 机构 | 3万-30万+/年 | Enterprise |

### Key Competitive Advantages to Build / 建议构建的竞争优势

1. **AI-First, No-Code**: 结合BigQuant的AI能力和果仁的无代码体验
2. **Mobile-First**: 所有竞品都是PC-first，移动端是蓝海
3. **Integrated Live Trading**: 解决聚宽/米筐/BigQuant的实盘痛点
4. **Modern Onboarding**: 借鉴Robinhood/Moomoo的引导式体验，而非"自己看文档"
5. **Strategy Marketplace 2.0**: 超越果仁的达人跟投，引入社交元素
6. **Transparent Pricing**: 避免"面议"模式，公开透明的阶梯定价

---

## Sources

### Platform Official Sites
- [JoinQuant 聚宽](https://www.joinquant.com/)
- [Uqer 优矿](https://uqer.datayes.com/)
- [RiceQuant 米筐](https://www.ricequant.com/)
- [MyQuant 掘金量化](https://www.myquant.cn/)
- [Guorn 果仁网](https://guorn.com/)
- [BigQuant](https://bigquant.com/)
- [SuperMind 同花顺量化](https://quant.10jqka.com.cn/)
- [Choice 东方财富量化](https://quantapi.eastmoney.com/)

### Analysis & Comparison Articles
- [小白该怎么入手量化平台 - 知乎](https://zhuanlan.zhihu.com/p/1949781193378764707)
- [量化交易软件排名 2025年最新 - 知乎](https://zhuanlan.zhihu.com/p/15670552648)
- [掘金、聚宽和米筐各量化平台优缺点 - 知乎](https://zhuanlan.zhihu.com/p/691473957)
- [2025年量化交易平台对比 - CSDN](https://blog.csdn.net/m0_52307083/details/149396173)
- [量化交易平台大盘点 - 知乎](https://zhuanlan.zhihu.com/p/686869989)
- [2024年做量化你一定要知道的11个量化平台 - 知乎](https://zhuanlan.zhihu.com/p/688890650)
- [2025国内量化软件盘点 - 知乎](https://zhuanlan.zhihu.com/p/1900199129319178840)
- [低门槛量化交易平台或成行业未来发展新主流 - 新浪](https://news.sina.cn/sx/2022-04-13/detail-imcwipii4025278.d.html)

### Platform-Specific Deep Dives
- [JoinQuant 36Kr Project Info](https://pitchhub.36kr.com/project/2079206715578115)
- [JoinQuant 未央网](https://www.weiyangx.com/318297.html)
- [RiceQuant 铅笔道](https://www.pencilnews.cn/d/12319.html)
- [果仁网 猎云网](https://lieyunpro.com/archives/350718)
- [BigQuant StockRanker 介绍](https://bigquant.com/wiki/doc/8DaJZW49tZ)
- [同花顺 i问财 产品分析](https://www.woshipm.com/evaluating/693910.html)
- [量化平台玩家的变现难题 - 界面新闻](https://www.jiemian.com/article/2202797.html)

### User Experience & Complaints
- [准备学习下量化 使用感受 - 知乎](https://www.zhihu.com/question/419359583)
- [掘金聚宽米筐优缺点2 - CSDN](https://blog.csdn.net/luansj/article/details/129725837)
- [市场上量化交易系统有哪些 - 知乎](https://zhuanlan.zhihu.com/p/697489843)
- [果仁网策略商城](https://guorn.com/membership/vip)
