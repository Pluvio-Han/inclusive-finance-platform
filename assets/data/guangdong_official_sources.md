# 广东真实数据样本库来源说明

本目录中的 `guangdong_official_raw_data.json` 为广东省官方公开统计数据首批样本库。

## 采集原则

- 仅采集官方公开来源
- 优先广东省统计局原始页面
- 每条记录保留 `source_title` 和 `source_url`
- 不人为补造数值
- 若官方页面仅公布增速，不公布绝对量，则 `value = null`，仅保留 `yoy_pct`

## 当前已入库官方来源

新增的 2026 官方来源已优先补入当前样本库，用于支撑“按年份筛选 2026”时的真实结果返回。

1. 广东省统计局：《2024年全年广东省地区生产总值》
   - https://stats.gd.gov.cn/jdgnsczz/content/post_4666322.html

2. 广东省统计局：《2025年1-6月广东主要统计指标》
   - https://stats.gd.gov.cn/gmjjzyzb/content/post_4750827.html

3. 广东省统计局：《2025年1-4月规模以上工业企业主要经济指标》
   - https://stats.gd.gov.cn/gkmlpt/content/4/4717/post_4717206.html

4. 广东省统计局：《2025年1-4月分行业规模以上工业销售产值》
   - https://stats.gd.gov.cn/fhygy/content/post_4714100.html

5. 广东省统计局：《2024年前三季度广东规模以上服务业运行简况》
   - https://stats.gd.gov.cn/tjkx185/content/post_4518502.html

6. 广东省统计局：《2024年广东经济运行简况新闻稿》
   - https://stats.gd.gov.cn/jjxsxwfbh/content/post_4700109.html

7. 广东省统计局：《2025年1-6月分市规模以上工业企业主要经济指标》
   - https://stats.gd.gov.cn/fsgyqy/content/post_4752178.html

8. 广东省统计局：《2024年广东消费品市场运行简况》
   - https://stats.gd.gov.cn/tjkx185/content/post_4660974.html

9. 广东省统计局：《2024年全年各市地区生产总值》
   - https://stats.gd.gov.cn/fsjdgnsczz/content/post_4666332.html

10. 广东省统计局：《2025年1-4月分行业规模以上工业增加值增速》
   - https://stats.gd.gov.cn/zyhygyzjz/content/post_4714084.html

11. 广东省统计局：《2025年1-4月分行业规模以上工业企业主要经济指标》
   - https://stats.gd.gov.cn/zyjjzb/content/post_4717201.html

12. 广东省统计局：《2026年1-2月广东主要统计指标》
   - http://stats.gd.gov.cn/gmjjzyzb/content/post_4874641.html

13. 广东省统计局：《2026年1-2月规模以上工业企业主要经济指标》
   - http://stats.gd.gov.cn/gyzyjjzb/content/post_4877800.html

14. 广东省统计局：《2026年1-2月分行业规模以上工业销售产值》
   - http://stats.gd.gov.cn/fhygy/content/post_4874676.html

15. 广东省统计局：《2026年1-2月分行业规模以上工业企业主要经济指标》
   - http://stats.gd.gov.cn/zyjjzb/content/post_4877814.html

## 当前覆盖主题

- 广东全省 GDP 与三次产业
- 广东工业、批发零售、金融业增加值
- 广东制造业、电子设备制造业、电气机械、汽车制造、通用设备等行业产值
- 广东规模以上工业企业单位数、营业收入、利润总额、平均用工人数
- 广东存贷款、住户存款、制造业用电量
- 广东信息传输/软件和信息技术服务业、先进制造业、高技术制造业投资/营收增速
- 广东社会消费品零售总额、商品零售、餐饮收入、线上零售增速
- 广东制造业、食品制造业、纺织业等行业增加值和资产类指标
- 广东 2026 年 1-2 月宏观、金融、用电、外贸、财政等最新指标
- 广东 2026 年 1-2 月制造业、电子设备、电气机械、汽车、通用设备等细分行业产值与经营指标
- 广东广州、深圳、佛山、东莞、珠海等分市 GDP
- 广州、深圳、东莞、佛山等分市工业资产样本

## 下一步建议

- 补充广东统计年鉴中的年度长序列
- 补充省内分市 GDP、工业增加值、社零总额
- 补充“科技服务”更细口径，如科学研究和技术服务业
- 将 JSON 进一步整理为统一长表字段：
  - `province`
  - `city`
  - `industry`
  - `indicator`
  - `period`
  - `value`
  - `unit`
  - `yoy_pct`
  - `source_url`
