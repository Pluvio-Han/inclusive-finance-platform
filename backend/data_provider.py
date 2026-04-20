"""
数据提供层 (Data Provider Layer)
-------------------------------
所有模拟数据集中管理在此。未来接入真实数据库/模型时，
仅需替换本文件中的函数实现，前端与 API 层完全无感知。
"""
import json
from pathlib import Path
from typing import Optional

ASSET_DATA_DIR = Path(__file__).resolve().parent.parent / "assets" / "data"
GUANGDONG_RAW_DATA_PATH = ASSET_DATA_DIR / "guangdong_official_raw_data.json"
CITY_KEYWORDS = {
    "广州": "广州市",
    "深圳": "深圳市",
    "佛山": "佛山市",
    "东莞": "东莞市",
    "珠海": "珠海市",
}

MAIN_INDUSTRY_OPTION_MAP = {
    "规模以上工业": ["规模以上工业", "工业"],
    "制造业": [
        "制造业",
        "先进制造业",
        "高技术制造业",
        "食品制造业",
        "纺织业",
        "通用设备制造业",
        "汽车制造业",
        "电气机械和器材制造业",
        "计算机、通信和其他电子设备制造业"
    ],
    "批发和零售": ["批发和零售", "批发和零售业", "商品零售", "住宿和餐饮"],
    "金融业": ["金融业", "银行业"],
    "软件和信息技术服务业": [
        "软件和信息技术服务业",
        "信息传输、软件和信息技术服务业",
        "科学研究和技术服务业",
        "租赁和商务服务业"
    ],
    "外贸": ["外贸", "工业出口"],
    "房地产业": ["房地产业"],
    "交通运输、仓储和邮政业": ["交通运输、仓储和邮政业"]
}


def _load_guangdong_raw_data():
    if not GUANGDONG_RAW_DATA_PATH.exists():
        return {"metadata": {}, "records": []}
    return json.loads(GUANGDONG_RAW_DATA_PATH.read_text(encoding="utf-8"))


def _normalize_city_token(token: str) -> str:
    token = (token or "").strip()
    if not token:
        return ""
    return CITY_KEYWORDS.get(token, token)


def _industry_aliases(industry: str):
    industry = (industry or "").strip()
    if not industry:
        return []
    return MAIN_INDUSTRY_OPTION_MAP.get(industry, [industry])


def _record_matches_industry(record_industry: str, selected_industry: str) -> bool:
    aliases = _industry_aliases(selected_industry)
    if not aliases:
        return True
    record_industry = (record_industry or "").strip()
    return any(alias == record_industry for alias in aliases)


def _build_empty_search_message(province: str = "", city: str = "", industry: str = "", year: str = "all") -> str:
    year_label = "全部年份" if year == "all" else ("2023及以前" if year == "older" else year)
    if city and industry:
        return f"{city} 在 {year_label} 暂无“{industry}”细分数据，建议优先切换为“规模以上工业”，或将城市改为“全部城市”。"
    if industry:
        return f"当前筛选条件下暂无“{industry}”数据，建议放宽年份，或切换到“规模以上工业”“制造业”等主行业。"
    if city:
        return f"{city} 在 {year_label} 暂无匹配记录，建议放宽年份，或改选其他城市后再检索。"
    if province:
        return f"{province} 在当前筛选条件下暂无匹配记录，建议调整行业或年份后重试。"
    return "未检索到匹配记录，请调整省份、城市、行业或年份条件后重试。"


def _filter_records(records, province: str = "", city: str = "", industry: str = "", year: str = "all"):
    filtered = []
    for record in records:
        record_province = str(record.get("province", "") or "").strip()
        record_city = str(record.get("city", "") or "").strip()
        record_industry = str(record.get("industry", "") or "").strip()
        period = str(record.get("period", "") or "")

        if province and record_province != province:
            continue
        if city and record_city != city:
            continue
        if industry and not _record_matches_industry(record_industry, industry):
            continue
        if year and year != "all":
            if year == "older":
                if "2025" in period or "2024" in period or "2026" in period:
                    continue
            elif year not in period:
                continue
        filtered.append(record)
    return filtered


def _period_rank(period: str) -> int:
    period = str(period or "")
    score = 0
    for y in ["2026", "2025", "2024", "2023", "2022"]:
        if y in period:
            score += int(y) * 100
            break
    if "1-6月" in period or "上半年" in period:
        score += 60
    elif "1-4月" in period:
        score += 40
    elif "1-3月" in period or "一季度" in period:
        score += 30
    elif "1-2月" in period:
        score += 20
    elif "年" in period:
        score += 90
    return score


def _pick_best_record(records, *, indicator_keywords=None, industry_keywords=None, city_required: Optional[bool] = None):
    indicator_keywords = indicator_keywords or []
    industry_keywords = industry_keywords or []
    candidates = []
    for record in records:
        indicator = str(record.get("indicator", "") or "")
        industry = str(record.get("industry", "") or "")
        city_value = str(record.get("city", "") or "")
        if indicator_keywords and not any(keyword in indicator for keyword in indicator_keywords):
            continue
        if industry_keywords and not any(keyword in industry for keyword in industry_keywords):
            continue
        if city_required is True and not city_value:
            continue
        if city_required is False and city_value:
            continue
        candidates.append(record)
    if not candidates:
        return None
    candidates.sort(key=lambda item: (_period_rank(item.get("period", "")), float(item.get("yoy_pct") or 0), float(item.get("value") or 0)), reverse=True)
    return candidates[0]


def _clamp(value: float, low: float = 0, high: float = 100) -> float:
    return max(low, min(high, value))


def _fmt_trend(yoy: Optional[float]):
    if yoy is None:
        return "+0.0%", "up"
    return f"{yoy:+.1f}%", "up" if yoy >= 0 else "down"


def _build_real_dashboard_overview(province: str = "", city: str = "", industry: str = "", year: str = "all"):
    dataset = _load_guangdong_raw_data()
    records = dataset.get("records", [])
    selected_province = province or dataset.get("metadata", {}).get("province", "广东")
    scoped_records = _filter_records(records, province=selected_province, city=city, industry="", year=year)
    industry_scoped_records = _filter_records(records, province=selected_province, city=city, industry=industry, year=year) if industry else scoped_records

    gdp_record = _pick_best_record(scoped_records, indicator_keywords=["地区生产总值"])
    social_retail_record = _pick_best_record(scoped_records, indicator_keywords=["社会消费品零售总额"])
    deposit_record = _pick_best_record(scoped_records, indicator_keywords=["存款余额"])
    loan_record = _pick_best_record(scoped_records, indicator_keywords=["贷款余额"])
    revenue_record = _pick_best_record(industry_scoped_records, indicator_keywords=["营业收入"])
    current_assets_record = _pick_best_record(industry_scoped_records, indicator_keywords=["流动资产合计"])
    power_record = _pick_best_record(industry_scoped_records, indicator_keywords=["用电量"])
    sales_output_record = _pick_best_record(industry_scoped_records, indicator_keywords=["规模以上工业销售产值"])
    added_value_record = _pick_best_record(industry_scoped_records, indicator_keywords=["增加值"], industry_keywords=_industry_aliases(industry) if industry else [])

    gdp_yoy = float(gdp_record.get("yoy_pct") or 0) if gdp_record else 0
    retail_yoy = float(social_retail_record.get("yoy_pct") or 0) if social_retail_record else 0
    deposit_yoy = float(deposit_record.get("yoy_pct") or 0) if deposit_record else 0
    loan_yoy = float(loan_record.get("yoy_pct") or 0) if loan_record else 0
    revenue_yoy = float(revenue_record.get("yoy_pct") or 0) if revenue_record else 0
    assets_yoy = float(current_assets_record.get("yoy_pct") or 0) if current_assets_record else 0
    power_yoy = float(power_record.get("yoy_pct") or 0) if power_record else 0
    sales_yoy = float(sales_output_record.get("yoy_pct") or 0) if sales_output_record else 0
    added_yoy = float(added_value_record.get("yoy_pct") or 0) if added_value_record else 0

    economy_score = round(_clamp(72 + gdp_yoy * 3.2 + retail_yoy * 1.6), 1)
    industry_score = round(_clamp(68 + sales_yoy * 1.7 + revenue_yoy * 1.2 + power_yoy * 0.9 + added_yoy * 1.1), 1)
    finance_score = round(_clamp(70 + deposit_yoy * 1.3 + loan_yoy * 1.0 + max(0, retail_yoy) * 0.8), 1)
    micro_score = round(_clamp(64 + revenue_yoy * 1.4 + assets_yoy * 0.8 - max(0, -sales_yoy) * 0.6), 1)
    npl_value = round(_clamp(3.15 - finance_score * 0.011 - micro_score * 0.008 + max(0, -revenue_yoy) * 0.03, 0.9, 3.8), 2)
    policy_score = round(_clamp((economy_score * 0.22) + (industry_score * 0.26) + (finance_score * 0.22) + (micro_score * 0.18) + ((4 - npl_value) * 18) * 0.12), 1)

    economy_trend, economy_direction = _fmt_trend(gdp_yoy)
    industry_trend, industry_direction = _fmt_trend(sales_yoy or added_yoy or revenue_yoy)
    finance_trend, finance_direction = _fmt_trend((deposit_yoy + loan_yoy) / 2 if deposit_record or loan_record else 0)
    micro_trend, micro_direction = _fmt_trend(revenue_yoy if revenue_record else assets_yoy)
    policy_trend, policy_direction = _fmt_trend((economy_score + industry_score + finance_score + micro_score) / 100 - 3.2)
    npl_trend = f"{-(abs(round(max(0.02, (finance_score - micro_score) / 850), 2))):+.2f}%"

    scope_label = city or selected_province
    industry_label = industry or "全行业"
    radar_credit = round(_clamp((finance_score * 0.58 + micro_score * 0.42)), 1)

    return {
        "kpis": [
            {
                "id": "economy",
                "name": "区域经济景气度",
                "value": economy_score,
                "trend": economy_trend,
                "direction": economy_direction,
                "source": f"{scope_label}地区生产总值 / 社零总额",
                "method": "真实统计值归一化合成"
            },
            {
                "id": "health",
                "name": "行业发展健康指数",
                "value": industry_score,
                "trend": industry_trend,
                "direction": industry_direction,
                "source": f"{scope_label} · {industry_label}销售产值 / 增加值 / 用电量",
                "method": "行业经营景气归一化"
            },
            {
                "id": "env",
                "name": "普惠金融环境指数",
                "value": finance_score,
                "trend": finance_trend,
                "direction": finance_direction,
                "source": f"{scope_label}存贷款余额与消费恢复",
                "method": "金融支持强度代理估算"
            },
            {
                "id": "micro",
                "name": "小微企业经营健康",
                "value": micro_score,
                "trend": micro_trend,
                "direction": micro_direction,
                "source": f"{scope_label} · {industry_label}营收/流动资产",
                "method": "经营活跃度代理估算"
            },
            {
                "id": "npl",
                "name": "普惠小微贷款不良率",
                "value": npl_value,
                "unit": "%",
                "trend": npl_trend,
                "direction": "down",
                "source": "金融环境与经营健康联合代理",
                "method": "真实统计代理测算"
            },
            {
                "id": "policy",
                "name": "政策实施有效性",
                "value": policy_score,
                "trend": policy_trend,
                "direction": policy_direction,
                "source": f"{scope_label} · {industry_label}真实统计综合",
                "method": "多指标综合评分"
            }
        ],
        "radar_data": [
            {"name": "经济景气", "value": economy_score, "max": 100},
            {"name": "行业健康", "value": industry_score, "max": 100},
            {"name": "普惠环境", "value": finance_score, "max": 100},
            {"name": "小微经营", "value": micro_score, "max": 100},
            {"name": "信用环境指数", "value": radar_credit, "max": 100},
            {"name": "政策效力", "value": policy_score, "max": 100}
        ],
        "last_updated": f"{scope_label} · {industry_label} · {year if year != 'all' else '全部年份'}"
    }


def get_raw_data_filter_options():
    dataset = _load_guangdong_raw_data()
    records = dataset.get("records", [])
    provinces = sorted({str(record.get("province", "")).strip() for record in records if record.get("province")})
    cities = sorted({str(record.get("city", "")).strip() for record in records if record.get("city")})
    industries = [
        option for option, aliases in MAIN_INDUSTRY_OPTION_MAP.items()
        if any(str(record.get("industry", "")).strip() in aliases for record in records)
    ]
    return {
        "provinces": provinces,
        "cities": cities,
        "industries": industries,
        "dataset": {
            "dataset_name": dataset.get("metadata", {}).get("dataset_name", "guangdong_official_raw_data"),
            "province": dataset.get("metadata", {}).get("province", "广东"),
            "version": dataset.get("metadata", {}).get("version", "v0.1"),
            "collected_at": dataset.get("metadata", {}).get("collected_at", "")
        }
    }


def search_raw_data(query: str = "", limit: int = 500, year: str = "all", province: str = "", city: str = "", industry: str = ""):
    dataset = _load_guangdong_raw_data()
    records = dataset.get("records", [])
    q = (query or "").strip().lower()
    province = (province or "").strip()
    city = (city or "").strip()
    industry = (industry or "").strip()
    has_structured_filters = any([province, city, industry, year and year != "all"])

    if not q and not has_structured_filters:
        return {
            "query": query,
            "filters": {
                "province": province,
                "city": city,
                "industry": industry,
                "year": year
            },
            "total": 0,
            "results": [],
            "dataset": dataset.get("metadata", {}),
            "message": "请选择省份、城市、行业或年份进行检索。"
        }

    tokens = [token for token in q.replace("，", " ").replace(",", " ").split() if token]
    if not tokens:
        tokens = [q]
    normalized_city_tokens = {_normalize_city_token(token) for token in tokens if _normalize_city_token(token)}
    matched_city_tokens = {city for city in normalized_city_tokens if any(str(record.get("city", "") or "").lower() == city for record in records)}
    has_city_filter = bool(matched_city_tokens)

    scored = []
    for record in records:
        period = str(record.get("period", ""))
        if year and year != "all":
            if year == "older":
                if "2025" in period or "2024" in period:
                    continue
            elif year not in period:
                continue

        record_province = str(record.get("province", "") or "").strip()
        record_city = str(record.get("city", "") or "").strip()
        record_industry = str(record.get("industry", "") or "").strip()

        if province and record_province != province:
            continue
        if city and record_city != city:
            continue
        if industry and not _record_matches_industry(record_industry, industry):
            continue

        city_value = record_city
        city_value_lower = city_value.lower()

        if has_city_filter and city_value_lower not in matched_city_tokens:
            continue

        haystack_parts = [
            record.get("province", ""),
            city_value,
            record.get("industry", ""),
            record.get("indicator", ""),
            record.get("period", ""),
            record.get("notes", ""),
            record.get("source_title", "")
        ]
        haystack = " ".join(str(part).lower() for part in haystack_parts if part is not None)
        matched_tokens = [token for token in tokens if token and token in haystack]
        if tokens != [""] and q and not matched_tokens:
            continue

        score = len(matched_tokens) * 10
        if record_province.lower() in tokens:
            score += 6
        if city_value_lower in matched_city_tokens:
            score += 18
        if record_industry.lower() in tokens:
            score += 6
        if record.get("indicator", "").lower() in tokens:
            score += 6
        if record.get("value") is not None:
            score += 2

        if record.get("value") in (None, "", "未披露"):
            continue

        indicator = str(record.get("indicator", ""))
        record_industry_label = str(record.get("industry", ""))
        category = str(record.get("category", ""))

        priority_boost = 0
        if "地区生产总值" in indicator:
            priority_boost += 12
        if "增加值" in indicator:
            priority_boost += 10
        if "社会消费品零售总额" in indicator:
            priority_boost += 9
        if "营业收入" in indicator:
            priority_boost += 8
        if "流动资产合计" in indicator:
            priority_boost += 7
        if "用电量" in indicator:
            priority_boost += 6
        if "贷款余额" in indicator or "存款余额" in indicator:
            priority_boost += 6
        if "制造业" in record_industry_label:
            priority_boost += 5
        if category in {"macro", "industry", "service", "consumption", "finance"}:
            priority_boost += 4
        if city_value:
            priority_boost += 3

        score += priority_boost

        scored.append((score, record))

    scored.sort(key=lambda item: (-item[0], item[1].get("period", ""), item[1].get("indicator", "")))
    results = [item[1] for item in scored[:limit]]
    if not results:
        return {
            "query": query,
            "year": year,
            "filters": {
                "province": province,
                "city": city,
                "industry": industry,
                "year": year
            },
            "total": 0,
            "results": [],
            "dataset": {
                "dataset_name": dataset.get("metadata", {}).get("dataset_name", "guangdong_official_raw_data"),
                "province": dataset.get("metadata", {}).get("province", "广东"),
                "version": dataset.get("metadata", {}).get("version", "v0.1"),
                "collected_at": dataset.get("metadata", {}).get("collected_at", "")
            },
            "message": _build_empty_search_message(province, city, industry, year)
        }
    return {
        "query": query,
        "year": year,
        "filters": {
            "province": province,
            "city": city,
            "industry": industry,
            "year": year
        },
        "total": len(scored),
        "results": results,
        "dataset": {
            "dataset_name": dataset.get("metadata", {}).get("dataset_name", "guangdong_official_raw_data"),
            "province": dataset.get("metadata", {}).get("province", "广东"),
            "version": dataset.get("metadata", {}).get("version", "v0.1"),
            "collected_at": dataset.get("metadata", {}).get("collected_at", "")
        },
        "message": f"已在广东官方样本库中匹配到 {len(scored)} 条原始记录。"
    }

# ============================================================
# 六大一级指标 KPI
# ============================================================
def get_dashboard_overview(province: str = "", city: str = "", industry: str = "", year: str = "all"):
    """返回驾驶舱首屏 6 大核心 KPI + 雷达图数据"""
    if province or city or industry or year != "all":
        return _build_real_dashboard_overview(province=province, city=city, industry=industry, year=year)

    return {
        "kpis": [
            {
                "id": "economy",
                "name": "区域经济景气度",
                "value": 86.4,
                "trend": "+1.2%",
                "direction": "up",
                "source": "国家统计局 GDP/PMI 合成",
                "method": "AHP + 熵权法加权"
            },
            {
                "id": "health",
                "name": "行业发展健康指数",
                "value": 78.2,
                "trend": "+3.4%",
                "direction": "up",
                "source": "工信部行业景气调查",
                "method": "PCA 主成分降维"
            },
            {
                "id": "env",
                "name": "普惠金融环境指数",
                "value": 82.1,
                "trend": "+0.5%",
                "direction": "up",
                "source": "央行二代征信 + 银保监报表",
                "method": "TOPSIS 综合评价"
            },
            {
                "id": "micro",
                "name": "小微企业经营健康",
                "value": 71.0,
                "trend": "-2.1%",
                "direction": "down",
                "source": "工商/税务脱敏特征",
                "method": "XGBoost 特征重要性排序"
            },
            {
                "id": "npl",
                "name": "普惠小微贷款不良率",
                "value": 2.14,
                "unit": "%",
                "trend": "-0.05%",
                "direction": "down",
                "source": "银保监不良贷款公报",
                "method": "移动平均 + 季节调整"
            },
            {
                "id": "policy",
                "name": "政策实施有效性",
                "value": 92.5,
                "trend": "+0.8%",
                "direction": "up",
                "source": "双重差分 (DID) 后验测算",
                "method": "PSM-DID 因果推断"
            }
        ],
        "radar_data": [
            {"name": "经济景气", "value": 86, "max": 100},
            {"name": "行业健康", "value": 78, "max": 100},
            {"name": "普惠环境", "value": 82, "max": 100},
            {"name": "小微经营", "value": 71, "max": 100},
            {"name": "信用环境指数", "value": 75, "max": 100},
            {"name": "政策效应", "value": 92, "max": 100}
        ],
        "last_updated": "2026-04-17T17:00:00+08:00"
    }


# ============================================================
# 区域信用热力图数据
# ============================================================
def get_risk_map(region_level: str = "province", metric: str = "credit_env_index"):
    """返回地图热力数据。"""
    province_data = [
        {"name": "北京", "value": 85}, {"name": "天津", "value": 78},
        {"name": "上海", "value": 92}, {"name": "重庆", "value": 75},
        {"name": "河北", "value": 65}, {"name": "河南", "value": 68},
        {"name": "云南", "value": 55}, {"name": "辽宁", "value": 60},
        {"name": "黑龙江", "value": 58}, {"name": "湖南", "value": 72},
        {"name": "安徽", "value": 73}, {"name": "山东", "value": 80},
        {"name": "新疆", "value": 50}, {"name": "江苏", "value": 88},
        {"name": "浙江", "value": 90}, {"name": "江西", "value": 70},
        {"name": "湖北", "value": 74}, {"name": "广西", "value": 62},
        {"name": "甘肃", "value": 52}, {"name": "山西", "value": 61},
        {"name": "内蒙古", "value": 59}, {"name": "陕西", "value": 66},
        {"name": "吉林", "value": 57}, {"name": "福建", "value": 82},
        {"name": "贵州", "value": 56}, {"name": "广东", "value": 95},
        {"name": "青海", "value": 48}, {"name": "西藏", "value": 45},
        {"name": "四川", "value": 77}, {"name": "宁夏", "value": 54},
        {"name": "海南", "value": 69}, {"name": "台湾", "value": 86},
        {"name": "香港", "value": 94}, {"name": "澳门", "value": 91}
    ]

    scatter_alerts = [
        {
            "name": "广东 (短期供应链脉冲)",
            "value": [113.28, 23.13, 100],
            "detail": "虽然长期信用指数健康(95分), 但近期装备制造上游出现违约传导信号。"
        },
        {
            "name": "上海 (跨境流动性波动)",
            "value": [121.47, 31.23, 80],
            "detail": "核心商圈小微企业短期融资转贷频率异常波动。"
        },
        {
            "name": "北京 (行业调控外溢预警)",
            "value": [116.41, 39.90, 70],
            "detail": "特定重点行业下沉小微配套链条现金流平衡面收窄。"
        }
    ]

    return {
        "metric": metric,
        "region_level": region_level,
        "map_data": province_data,
        "scatter_alerts": scatter_alerts,
        "legend": {
            "min": 40, "max": 100,
            "low_label": "高风险区", "high_label": "普惠环境优"
        }
    }


# ============================================================
# 趋势预测数据
# ============================================================
def get_trends(indicator: str = "npl"):
    """返回时间序列 + LSTM 预测"""
    months = [f"24-{str(i).zfill(2)}" for i in range(1, 13)]
    months_extended = months + ["25-01", "25-02", "25-03"]
    
    if indicator == "loan_balance":
        actual = [12, 12.5, 13, 13.8, 14.2, 15, 15.5, 16.2, 17, 17.5, 18.2, 19] 
        prediction = [None]*10 + [18.2, 19, 19.8, 20.5, 21.2]
        confidence_upper = [val + 0.5 if val else None for val in prediction]
        confidence_lower = [val - 0.5 if val else None for val in prediction]
    else: 
        actual = [2.50, 2.45, 2.40, 2.38, 2.35, 2.30, 2.25, 2.28, 2.20, 2.18, 2.15, 2.14]
        prediction = [None]*10 + [2.15, 2.14, 2.12, 2.05, 1.95]
        confidence_upper = [None]*10 + [2.20, 2.22, 2.25, 2.20, 2.15]
        # 修正：下界不能过于乐观
        confidence_lower = [None]*10 + [2.10, 2.06, 2.02, 1.92, 1.82]

    return {
        "indicator": indicator,
        "months": months_extended,
        "actual": actual,
        "prediction": prediction,
        "confidence_upper": confidence_upper,
        "confidence_lower": confidence_lower,
        "model": "LSTM (128 units, 2 layers, DropOut=0.2)",
        "confidence_level": "95.8%"
    }


# ============================================================
# 产业链关系图谱
# ============================================================
def get_industry_graph(industry: str = "manufacturing"):
    """返回产业链风险传导图谱节点与边"""
    industry_meta = {
        "manufacturing": {
            "summary": "制造业链条呈现“核心企业订单修复、上游账期偏长、下游回款分化”的传导特征，适合采用担保增信 + 利率优惠 + 技改补贴的组合策略。节点风险分值反映短期流动性与账期压力，与区域长期信用环境指数口径不同。",
            "policy_hint": "优先锁定现金流承压且订单稳定的链上节点，先稳融资再稳产能。",
            "focus_node_id": "2"
        },
        "retail": {
            "summary": "批发零售链条对消费景气和库存周转更敏感，应侧重周转类流贷支持和终端补贴拉动。节点风险分值反映短期流动性与账期压力，与区域长期信用环境指数口径不同。",
            "policy_hint": "优先缓解终端经销与仓储节点的短期流动性冲击。",
            "focus_node_id": "4"
        },
        "service": {
            "summary": "服务业链条轻资产、现金流波动更快，宜通过贴息与信用担保稳定经营性现金流。节点风险分值反映短期流动性与账期压力，与区域长期信用环境指数口径不同。",
            "policy_hint": "优先覆盖吸纳就业较多但抗冲击能力较弱的服务节点。",
            "focus_node_id": "3"
        }
    }
    active_meta = industry_meta.get(industry, industry_meta["manufacturing"])
    return {
        "industry": industry,
        "industry_summary": active_meta["summary"],
        "policy_hint": active_meta["policy_hint"],
        "focus_node_id": active_meta["focus_node_id"],
        "nodes": [
            {
                "id": "0",
                "name": "区域政策银行",
                "symbolSize": 45,
                "category": 0,
                "risk_level": "低",
                "risk_score": 34,
                "description": "承担普惠转贷和续贷支持，是链上融资供给入口。",
                "policy_focus": "维持定向利率优惠并扩大首贷覆盖。",
                "recommended_adjustments": {
                    "guarantee_rate_delta": 2,
                    "interest_offset_delta": -0.3,
                    "subsidy_level_delta": 0
                }
            },
            {
                "id": "1",
                "name": "核心制造企业A",
                "symbolSize": 35,
                "category": 1,
                "risk_level": "中",
                "risk_score": 58,
                "description": "订单修复中但对上下游回款传导敏感，是产业链信用锚点。",
                "policy_focus": "强化担保增信并配置中等补贴，稳住核心订单与票据周转。",
                "recommended_adjustments": {
                    "guarantee_rate_delta": 5,
                    "interest_offset_delta": -0.4,
                    "subsidy_level_delta": 1
                }
            },
            {
                "id": "2",
                "name": "上游供应商B",
                "symbolSize": 22,
                "category": 2,
                "risk_level": "高",
                "risk_score": 82,
                "description": "应收账款回收周期偏长，原料采购对短贷依赖度高。",
                "policy_focus": "优先加大利率优惠与担保比例，缓解短期转贷压力。",
                "recommended_adjustments": {
                    "guarantee_rate_delta": 8,
                    "interest_offset_delta": -0.7,
                    "subsidy_level_delta": 1
                }
            },
            {
                "id": "3",
                "name": "上游供应商C",
                "symbolSize": 22,
                "category": 2,
                "risk_level": "中高",
                "risk_score": 71,
                "description": "现金流受订单波动影响明显，需技改资金与稳岗支持并行。",
                "policy_focus": "适度提高补贴覆盖，配合担保缓释现金流缺口。",
                "recommended_adjustments": {
                    "guarantee_rate_delta": 6,
                    "interest_offset_delta": -0.5,
                    "subsidy_level_delta": 2
                }
            },
            {
                "id": "4",
                "name": "下游经销商D",
                "symbolSize": 28,
                "category": 3,
                "risk_level": "中",
                "risk_score": 63,
                "description": "回款受终端消费波动影响，库存周转阶段性承压。",
                "policy_focus": "以贴息和阶段性补贴稳定终端需求恢复。",
                "recommended_adjustments": {
                    "guarantee_rate_delta": 3,
                    "interest_offset_delta": -0.6,
                    "subsidy_level_delta": 1
                }
            },
            {
                "id": "5",
                "name": "地方担保机构",
                "symbolSize": 38,
                "category": 0,
                "risk_level": "低",
                "risk_score": 41,
                "description": "承担风险缓释与财政协同角色，是政策落地的中枢节点。",
                "policy_focus": "需同步补充代偿准备金和白名单准入机制。",
                "recommended_adjustments": {
                    "guarantee_rate_delta": 4,
                    "interest_offset_delta": -0.2,
                    "subsidy_level_delta": 0
                }
            },
            {
                "id": "6",
                "name": "原材料供应商E",
                "symbolSize": 18,
                "category": 2,
                "risk_level": "高",
                "risk_score": 76,
                "description": "原材料价格波动放大了资金占用，账期和库存风险同步上升。",
                "policy_focus": "建议叠加贴息与补贴，降低补库成本和经营波动。",
                "recommended_adjustments": {
                    "guarantee_rate_delta": 5,
                    "interest_offset_delta": -0.8,
                    "subsidy_level_delta": 2
                }
            }
        ],
        "links": [
            {"source": "0", "target": "1", "value": 0.88, "risk_type": "授信供给", "explanation": "政策银行授信意愿直接决定核心企业票据与流贷可得性。"},
            {"source": "5", "target": "1", "value": 0.74, "risk_type": "担保增信", "explanation": "担保覆盖率提升可显著缓释核心企业首贷与续贷门槛。"},
            {"source": "1", "target": "2", "value": 0.91, "risk_type": "订单拖欠", "explanation": "核心企业回款节奏变化会快速传导至上游账期。"},
            {"source": "1", "target": "3", "value": 0.79, "risk_type": "产能协同", "explanation": "技改与订单修复会影响配套供应商现金流稳定性。"},
            {"source": "1", "target": "4", "value": 0.68, "risk_type": "渠道分销", "explanation": "下游经销回款决定链条资金回流速度。"},
            {"source": "2", "target": "6", "value": 0.83, "risk_type": "原料价格", "explanation": "原材料价格与库存波动会放大上游资金占用压力。"},
            {"source": "0", "target": "5", "value": 0.57, "risk_type": "财政协同", "explanation": "金融机构与担保机构协同决定政策工具的落地效率。"}
        ],
        "categories": [
            {"name": "金融机构"},
            {"name": "核心企业"},
            {"name": "上游产业"},
            {"name": "下游产业"}
        ]
    }


# ============================================================
# 预警滚动消息
# ============================================================
def get_ticker_messages():
    return {
        "messages": [
            "模拟预警: 广东省某制造业协会出现产业链违约异动信号，风险指数升级至 [黄色警告]...",
            "实时监控: 上海地区由于跨区域流动性收紧，中小微企业融资成本平均上升 0.15%...",
            "AI 风险推演: 预计下季度传统零售业景气度下降，建议调整不良率容忍度拨备...",
            "系统提示: 国家发改委最新降准政策已并入沙盘，可前往右侧 [动态政策模拟沙盘] 进行推演验证"
        ]
    }


# ============================================================
# 政策模拟推演
# ============================================================
def _classify_policy_bucket(did_effect: float) -> str:
    if did_effect > 0.5:
        return "强干预方案"
    if did_effect > 0.2:
        return "均衡推进方案"
    return "温和校准方案"


def _classify_intensity(value: float, low: float, high: float, labels: tuple[str, str, str]) -> str:
    if value >= high:
        return labels[2]
    if value >= low:
        return labels[1]
    return labels[0]


def _build_policy_tools(guarantee_rate: float, interest_offset: float, subsidy_level: int):
    return [
        {
            "name": "政府担保拨备",
            "intensity": _classify_intensity(guarantee_rate, 12, 20, ("基础", "增强", "高强度")),
            "rationale": "通过提高风险分担比例，释放银行对制造业及配套小微企业的授信意愿。"
        },
        {
            "name": "利率优惠传导",
            "intensity": _classify_intensity(abs(interest_offset), 0.6, 1.1, ("温和", "中等", "显著")),
            "rationale": "压降融资成本，缓释转贷压力，对现金流脆弱企业形成短期托底。"
        },
        {
            "name": "产业补贴覆盖",
            "intensity": ("低", "中", "高")[max(0, min(subsidy_level - 1, 2))],
            "rationale": "用于技改、订单恢复和就业稳定，提升政策覆盖面的可见度。"
        }
    ]


def _build_transmission_paths(guarantee_rate: float, interest_offset: float, subsidy_level: int, did_effect: float):
    return [
        {
            "stage": "金融供给侧",
            "impact": f"担保拨备提升至 {int(guarantee_rate)}%，银行风险暴露下降，授信意愿增强。"
        },
        {
            "stage": "企业融资侧",
            "impact": f"利率优惠 {interest_offset:.2f}% 带动转贷与续贷成本下降，并与担保、补贴协同形成 {did_effect:.3f} 的综合政策效应。"
        },
        {
            "stage": "产业经营侧",
            "impact": f"补贴等级 {subsidy_level} 主要作用于技改、订单修复和稳岗，改善产业链核心节点现金流。"
        }
    ]


def _build_target_segments(guarantee_rate: float, interest_offset: float, subsidy_level: int):
    segments = ["制造业配套小微企业", "供应链上游原材料企业"]
    if abs(interest_offset) >= 0.8:
        segments.append("短期转贷压力较高的流动性承压企业")
    if subsidy_level >= 2:
        segments.append("处于技改或订单修复阶段的产业集群")
    if guarantee_rate >= 18:
        segments.append("担保依赖度较高但订单稳定的首贷户")
    return segments


def _build_implementation_conditions(guarantee_rate: float, interest_offset: float, subsidy_level: int):
    conditions = [
        "需保持财政拨备与担保代偿准备金同步安排。",
        "政策评估应按季度复核不良率与受益企业覆盖面。"
    ]
    if abs(interest_offset) > 1.0:
        conditions.append("需同步监测银行净息差压力，避免出现信用供给收缩。")
    if subsidy_level >= 3:
        conditions.append("建议与专项债、技改贴息等工具协同，避免单一补贴挤出。")
    if guarantee_rate >= 20:
        conditions.append("高担保场景下应叠加准入清单与白名单机制，控制财政流动性风险。")
    return conditions


def _build_evidence_points(did_effect: float, roi: float, benefit_enterprises: int):
    return [
        f"PSM-DID 估计量为 {did_effect:.4f}，用于衡量净政策效应方向与强度。",
        f"单位 ROI 为 {roi}，口径统一为每亿元财政投入收益企业数。",
        f"预计受益企业 {benefit_enterprises} 家，可用于答辩时解释覆盖面效果。"
    ]


def _build_scorecard(did_effect: float, roi: float, benefit_enterprises: int, guarantee_rate: float, subsidy_level: int):
    efficiency_score = round(min(100, roi / 200), 1)
    coverage_score = round(min(100, benefit_enterprises / 220), 1)
    implementation_score = round(max(55, 92 - max(0, guarantee_rate - 18) * 1.5 - max(0, subsidy_level - 2) * 4), 1)
    composite_score = round(efficiency_score * 0.4 + coverage_score * 0.35 + implementation_score * 0.25, 1)
    return {
        "efficiency_score": efficiency_score,
        "coverage_score": coverage_score,
        "implementation_score": implementation_score,
        "composite_score": composite_score
    }


def _build_policy_result(guarantee_rate: float, interest_offset: float, subsidy_level: int):
    """统一封装政策模拟结果，保证前后端口径稳定。"""
    current_npl = 2.14

    # 简化的因果推断模拟 (模拟 DID 估计量)
    did_effect = (guarantee_rate - 10) * 0.018 + abs(interest_offset) * 0.42 + subsidy_level * 0.12
    new_npl = max(0.8, current_npl - did_effect)

    # 成本收益
    fiscal_cost = guarantee_rate * 0.8 + subsidy_level * 2.5  # 亿元
    benefit_enterprises = int(12000 + did_effect * 8000)

    # 修正 ROI 算法：每亿元财政投入带动的受益企业数 (更有经济意义)
    roi = round(benefit_enterprises / (fiscal_cost + 0.1), 1)

    # 生成预测序列
    prediction_months = ["25-01", "25-02", "25-03"]
    prediction_values = []
    step_reduction = (current_npl - new_npl) / 3
    for i in range(1, 4):
        prediction_values.append(round(current_npl - step_reduction * i, 2))

    warnings = [
        "担保拨备率过高可能引发地方财政流动性压力" if guarantee_rate > 20 else None,
        "利率降幅超过1%需关注银行净息差压缩" if abs(interest_offset) > 1.0 else None,
        "高补贴覆盖需配合中央专项债使用" if subsidy_level >= 3 else None,
    ]
    policy_bucket = _classify_policy_bucket(did_effect)
    policy_tools = _build_policy_tools(guarantee_rate, interest_offset, subsidy_level)
    transmission_paths = _build_transmission_paths(guarantee_rate, interest_offset, subsidy_level, did_effect)
    target_segments = _build_target_segments(guarantee_rate, interest_offset, subsidy_level)
    implementation_conditions = _build_implementation_conditions(guarantee_rate, interest_offset, subsidy_level)
    evidence_points = _build_evidence_points(did_effect, roi, benefit_enterprises)
    scorecard = _build_scorecard(did_effect, roi, benefit_enterprises, guarantee_rate, subsidy_level)

    return {
        "current_npl": current_npl,
        "predicted_npl": round(new_npl, 2),
        "did_estimate": round(did_effect, 4),
        "fiscal_cost_billion": round(fiscal_cost, 1),
        "benefit_enterprise_count": benefit_enterprises,
        "roi": roi,
        "roi_unit": "每亿元财政投入收益企业数",
        "effect_direction": "positive" if did_effect >= 0 else "negative",
        "policy_bucket": policy_bucket,
        "scenario_summary": f"担保{int(guarantee_rate)}% / 利率优惠{interest_offset:.2f}% / 补贴等级{subsidy_level}",
        "risk_warnings": warnings,
        "prediction_months": prediction_months,
        "prediction_values": prediction_values,
        "policy_tools": policy_tools,
        "transmission_paths": transmission_paths,
        "target_segments": target_segments,
        "implementation_conditions": implementation_conditions,
        "evidence_points": evidence_points,
        "scorecard": scorecard,
        "policy_recommendation": _generate_recommendation(guarantee_rate, interest_offset, subsidy_level, did_effect)
    }


def simulate_policy(guarantee_rate: float, interest_offset: float, subsidy_level: int):
    """基于输入参数进行简化的政策效果推演。"""
    return _build_policy_result(guarantee_rate, interest_offset, subsidy_level)


def _generate_recommendation(g, r, s, effect):
    """生成结构化政策建议"""
    if effect > 0.5:
        return f"当前政策组合预计具有显著正向效应，建议优先在特定产业集群试点推行。"
    elif effect > 0.2:
        return "政策力度适中，建议结合地方财政承受能力逐步推广。"
    else:
        return "当前参数调整幅度较小，政策边际效应有限，建议适度加大担保或利率优惠。"


# ============================================================
# 省份下钻详情
# ============================================================
_PROVINCE_DATA = {
    "广东": {"npl": 1.85, "credit": 95, "micro": 82, "alert": "制造业上游原材料违约脉冲信号持续，需关注供应链传导风险。"},
    "上海": {"npl": 1.42, "credit": 92, "micro": 88, "alert": "跨区域流动性短期收紧，国际结算类小微融资成本上行。"},
    "北京": {"npl": 1.61, "credit": 85, "micro": 79, "alert": "房地产调控政策外溢效应，相关产业链下游现金流承压。"},
    "浙江": {"npl": 1.72, "credit": 90, "micro": 85, "alert": None},
    "江苏": {"npl": 1.93, "credit": 88, "micro": 83, "alert": None},
    "山东": {"npl": 2.10, "credit": 80, "micro": 75, "alert": "能源化工上游波动影响下游小微企业原材料采购成本。"},
    "河南": {"npl": 2.45, "credit": 68, "micro": 65, "alert": "农村普惠金融覆盖率偏低，建议加大定向降准政策力度。"},
    "湖南": {"npl": 2.22, "credit": 72, "micro": 70, "alert": None},
}

_INDUSTRY_PIE = {
    "广东": [{"name": "制造业", "value": 42}, {"name": "批发零售", "value": 18}, {"name": "科技服务", "value": 20}, {"name": "建筑业", "value": 12}, {"name": "其他", "value": 8}],
    "上海": [{"name": "金融业", "value": 35}, {"name": "科技服务", "value": 28}, {"name": "批发零售", "value": 20}, {"name": "航运物流", "value": 12}, {"name": "其他", "value": 5}],
    "default": [{"name": "制造业", "value": 30}, {"name": "批发零售", "value": 25}, {"name": "建筑业", "value": 20}, {"name": "农林牧渔", "value": 15}, {"name": "其他", "value": 10}]
}

_RISK_FACTORS = {
    "广东": {"宏观经济波动": 28, "产业链信用传导": 35, "流动性风险": 20, "政策合规风险": 8, "外部冲击": 9},
    "上海": {"宏观经济波动": 18, "产业链信用传导": 20, "流动性风险": 30, "政策合规风险": 15, "外部冲击": 17},
    "default": {"宏观经济波动": 30, "产业链信用传导": 25, "流动性风险": 22, "政策合规风险": 12, "外部冲击": 11}
}

def get_province_detail(province: str):
    """返回省份风险画像详情"""
    # 模糊匹配省份名（去掉省/市/区后缀）
    key = province.replace("省", "").replace("市", "").replace("自治区", "")
    
    # 获取数据，使用中立默认值，避免盲目基于广东计算
    base_data = _PROVINCE_DATA.get(key, {"npl": 2.30, "credit": 65, "micro": 60, "alert": None})
    
    pie_data = _INDUSTRY_PIE.get(key, _INDUSTRY_PIE["default"])
    factors = _RISK_FACTORS.get(key, _RISK_FACTORS["default"])
    
    return {
        "province": province,
        "npl": base_data.get("npl", 2.30),
        "credit_index": base_data.get("credit", 65),
        "micro_health": base_data.get("micro", 60),
        "alert": base_data.get("alert"),
        "industry_distribution": pie_data,
        "risk_factors": [{"name": k, "value": v} for k, v in factors.items()]
    }
