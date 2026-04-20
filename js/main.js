/**
 * 普惠金融风险动态评估平台 - 前端主控逻辑
 * ==========================================
 * 数据流策略:
 *   优先从 FastAPI 后端拉取 -> 若后端不可用则回退到 mock_data.js
 *   这使得系统无论是纯静态文件打开还是后端启动均可正常运行。
 */

// ============================================================
// 数据适配层 (Data Adapter)
// ============================================================
const API_BASE = '/api/v1';
const reportState = {
    latestPolicyResult: null,
    comparison: null,
    industrySelection: null,
    activeView: 'dashboard'
};
let activeIndustryNode = null;
let currentIndustryView = 'manufacturing';
let currentRegionView = '广东';
let regionGeoLoaded = false;
let dashboardBaseOverview = null;

const industryScenarioLibrary = {
    manufacturing: {
        label: '制造业',
        riskLevel: '中高风险',
        riskScore: 71,
        mainDriver: '账期拉长',
        driverDesc: '上游回款拖延导致流动性承压',
        policyFocus: '担保增信 + 中等贴息',
        policyDesc: '先稳融资，再稳订单修复节奏',
        months: ['24-01', '24-02', '24-03', '24-04', '24-05', '24-06', '24-07', '24-08', '24-09', '24-10', '24-11', '24-12'],
        riskSeries: [61, 63, 65, 64, 66, 68, 69, 72, 74, 73, 72, 71],
        heatmap: {
            metrics: ['融资成本', '订单景气', '账期压力', '补贴敏感度'],
            stages: ['Q1', 'Q2', 'Q3', 'Q4'],
            values: [
                [0, 0, 58], [1, 0, 61], [2, 0, 64], [3, 0, 66],
                [0, 1, 62], [1, 1, 59], [2, 1, 68], [3, 1, 72],
                [0, 2, 66], [1, 2, 69], [2, 2, 76], [3, 2, 81],
                [0, 3, 49], [1, 3, 55], [2, 3, 60], [3, 3, 57]
            ]
        },
        nodeRanking: [
            { name: '上游供应商B', value: 82 },
            { name: '原材料供应商E', value: 76 },
            { name: '上游供应商C', value: 71 },
            { name: '下游经销商D', value: 63 },
            { name: '核心制造企业A', value: 58 }
        ],
        insights: [
            '订单修复已启动，但上游账期压力尚未释放，链上融资成本仍处于偏高区间。',
            '补贴对技改恢复有效，但单独补贴不足以压降上游短贷脉冲，需要担保增信配合。',
            '当前更适合以“核心企业稳单 + 上游配套稳流动性”的分层干预策略推进。',
            '当前行业分值基于宏观景气度建模，节点分值侧重短期账期脉冲，存在差异化风险穿透效应。'
        ]
    },
    retail: {
        label: '批发零售',
        riskLevel: '中风险',
        riskScore: 64,
        mainDriver: '消费波动',
        driverDesc: '终端修复节奏不稳导致库存周转承压',
        policyFocus: '贴息托底 + 渠道补贴',
        policyDesc: '优先稳定终端回款和仓储节点周转',
        months: ['24-01', '24-02', '24-03', '24-04', '24-05', '24-06', '24-07', '24-08', '24-09', '24-10', '24-11', '24-12'],
        riskSeries: [67, 69, 68, 70, 72, 73, 71, 69, 67, 66, 65, 64],
        heatmap: {
            metrics: ['融资成本', '消费景气', '库存压力', '补贴敏感度'],
            stages: ['Q1', 'Q2', 'Q3', 'Q4'],
            values: [
                [0, 0, 55], [1, 0, 60], [2, 0, 58], [3, 0, 57],
                [0, 1, 74], [1, 1, 78], [2, 1, 70], [3, 1, 66],
                [0, 2, 72], [1, 2, 76], [2, 2, 69], [3, 2, 64],
                [0, 3, 51], [1, 3, 54], [2, 3, 60], [3, 3, 63]
            ]
        },
        nodeRanking: [
            { name: '渠道经销节点', value: 76 },
            { name: '区域仓储中心', value: 71 },
            { name: '平台商户集群', value: 68 },
            { name: '终端门店网络', value: 63 },
            { name: '结算金融节点', value: 57 }
        ],
        insights: [
            '渠道库存是当前零售链条的核心脉冲点，回款修复速度决定风险拐点。',
            '单纯降息效果有限，叠加终端补贴后对回款改善更明显。',
            '建议优先覆盖仓储和分销节点，再向终端商户扩散。'
        ]
    },
    service: {
        label: '科技服务',
        riskLevel: '温和风险',
        riskScore: 57,
        mainDriver: '现金流波动',
        driverDesc: '项目制收入与人力成本错配形成阶段性压力',
        policyFocus: '信用担保 + 税费缓冲',
        policyDesc: '先稳经营现金流，再做扩张性扶持',
        months: ['24-01', '24-02', '24-03', '24-04', '24-05', '24-06', '24-07', '24-08', '24-09', '24-10', '24-11', '24-12'],
        riskSeries: [59, 60, 61, 60, 58, 57, 56, 55, 54, 56, 57, 57],
        heatmap: {
            metrics: ['融资成本', '项目景气', '人力压力', '贴息敏感度'],
            stages: ['Q1', 'Q2', 'Q3', 'Q4'],
            values: [
                [0, 0, 48], [1, 0, 50], [2, 0, 52], [3, 0, 53],
                [0, 1, 61], [1, 1, 58], [2, 1, 55], [3, 1, 57],
                [0, 2, 69], [1, 2, 66], [2, 2, 63], [3, 2, 62],
                [0, 3, 57], [1, 3, 60], [2, 3, 58], [3, 3, 59]
            ]
        },
        nodeRanking: [
            { name: '外包交付团队', value: 69 },
            { name: '轻资产服务商', value: 63 },
            { name: '区域软件企业', value: 58 },
            { name: '技术集成商', value: 55 },
            { name: '创新孵化节点', value: 49 }
        ],
        insights: [
            '科技服务业整体波动低于制造链，但项目回款和人力成本错配是主要风险源。',
            '对轻资产企业而言，信用担保比大规模补贴更能改善现金流稳定性。',
            '建议围绕就业吸纳和项目回款周期设计定向扶持。'
        ]
    }
};

const regionScenarioLibrary = {
    '广东': {
        province: '广东',
        credit: 95,
        micro: 82,
        npl: 1.85,
        policyPack: '温和贴息 + 定向担保',
        policyDesc: '优先覆盖制造链上游与首贷户',
        creditDesc: '普惠金融基础设施成熟',
        microDesc: '订单韧性优于全国均值',
        industryDistribution: [
            { name: '制造业', value: 34 },
            { name: '批发零售', value: 24 },
            { name: '科技服务', value: 18 },
            { name: '建筑业', value: 14 },
            { name: '其他', value: 10 }
        ],
        riskFactors: [
            { name: '产业链信用传导', value: 31 },
            { name: '跨区流动性收紧', value: 24 },
            { name: '订单错配', value: 19 },
            { name: '政策协同不足', value: 14 },
            { name: '外部冲击', value: 12 }
        ],
        insights: [
            '制造业核心省份信用环境优，但上游配套企业的短期脉冲风险仍需专项盯防。',
            '区域优势在于金融供给能力强，短板在于产业链节点分化加剧。',
            '建议采用“核心企业稳单 + 上游增信 + 技改补贴”三段式策略。'
        ]
    },
    '江苏': {
        province: '江苏',
        credit: 88,
        micro: 83,
        npl: 1.93,
        policyPack: '均衡贴息 + 产业集群扶持',
        policyDesc: '重点稳住外向型制造与配套加工链',
        creditDesc: '区域信用供给能力较强',
        microDesc: '小微经营恢复较快但分化明显',
        industryDistribution: [
            { name: '制造业', value: 31 },
            { name: '批发零售', value: 22 },
            { name: '物流仓储', value: 17 },
            { name: '科技服务', value: 15 },
            { name: '其他', value: 15 }
        ],
        riskFactors: [
            { name: '外需波动', value: 29 },
            { name: '流动性约束', value: 23 },
            { name: '上下游账期', value: 20 },
            { name: '财政协同压力', value: 15 },
            { name: '政策合规风险', value: 13 }
        ],
        insights: [
            '外向型链条波动更敏感，区域风险更多来自订单端而非金融供给端。',
            '物流与仓储节点是当前信用传导的重要缓冲层。',
            '建议优先扶持出口导向集群的现金流稳定。'
        ]
    },
    '浙江': {
        province: '浙江',
        credit: 90,
        micro: 85,
        npl: 1.72,
        policyPack: '轻资产担保 + 创新贴息',
        policyDesc: '优先支持数字经济与制造服务融合节点',
        creditDesc: '市场化信用环境成熟',
        microDesc: '民营中小企业韧性较强',
        industryDistribution: [
            { name: '制造业', value: 28 },
            { name: '电商零售', value: 23 },
            { name: '科技服务', value: 20 },
            { name: '物流仓储', value: 14 },
            { name: '其他', value: 15 }
        ],
        riskFactors: [
            { name: '平台订单波动', value: 27 },
            { name: '融资成本', value: 22 },
            { name: '账期拖延', value: 21 },
            { name: '库存周转', value: 16 },
            { name: '政策协同', value: 14 }
        ],
        insights: [
            '区域整体信用环境好，但平台链条波动会放大轻资产企业的现金流敏感性。',
            '更适合低干预、快传导的信用担保与贴息组合。',
            '建议围绕数字贸易和制造服务融合场景配置政策工具。'
        ]
    },
    '四川': {
        province: '四川',
        credit: 77,
        micro: 72,
        npl: 2.04,
        policyPack: '强化担保 + 区域补贴',
        policyDesc: '优先稳定区域产业集群与就业吸纳节点',
        creditDesc: '区域信用修复空间较大',
        microDesc: '经营健康度受产业迁移影响',
        industryDistribution: [
            { name: '制造业', value: 26 },
            { name: '农食加工', value: 22 },
            { name: '批发零售', value: 20 },
            { name: '建筑业', value: 17 },
            { name: '其他', value: 15 }
        ],
        riskFactors: [
            { name: '融资可得性', value: 30 },
            { name: '产业迁移扰动', value: 24 },
            { name: '订单稳定性', value: 19 },
            { name: '政策覆盖不足', value: 15 },
            { name: '外部冲击', value: 12 }
        ],
        insights: [
            '四川当前更需要提升信用可得性，而不是单独追求贴息力度。',
            '就业吸纳型产业和区域集群稳定性，是政策设计的第一优先级。',
            '建议先做担保兜底，再推动产业补贴向重点节点倾斜。'
        ]
    }
};

async function fetchData(endpoint, fallback) {
    try {
        const resp = await fetch(API_BASE + endpoint);
        if (!resp.ok) throw new Error(resp.status);
        return await resp.json();
    } catch (e) {
        console.warn(`[DataAdapter] API ${endpoint} 不可用, 回退到本地数据`, e.message);
        return fallback;
    }
}

function buildLocalPolicyResult(guaranteeRate, interestOffset, subsidyLevel) {
    const currentNpl = 2.14;
    const didEffect = (guaranteeRate - 10) * 0.018 + Math.abs(interestOffset) * 0.42 + subsidyLevel * 0.12;
    const predictedNpl = Math.max(0.8, currentNpl - didEffect);
    const fiscalCost = guaranteeRate * 0.8 + subsidyLevel * 2.5;
    const benefitEnterpriseCount = Math.round(12000 + didEffect * 8000);
    const roi = Number((benefitEnterpriseCount / (fiscalCost + 0.1)).toFixed(1));
    const policyBucket = didEffect > 0.5 ? '强干预方案' : (didEffect > 0.2 ? '均衡推进方案' : '温和校准方案');
    const efficiencyScore = Number(Math.min(100, roi / 200).toFixed(1));
    const coverageScore = Number(Math.min(100, benefitEnterpriseCount / 220).toFixed(1));
    const implementationScore = Number(Math.max(55, 92 - Math.max(0, guaranteeRate - 18) * 1.5 - Math.max(0, subsidyLevel - 2) * 4).toFixed(1));
    const compositeScore = Number((efficiencyScore * 0.4 + coverageScore * 0.35 + implementationScore * 0.25).toFixed(1));

    return {
        current_npl: currentNpl,
        predicted_npl: Number(predictedNpl.toFixed(2)),
        did_estimate: Number(didEffect.toFixed(4)),
        fiscal_cost_billion: Number(fiscalCost.toFixed(1)),
        benefit_enterprise_count: benefitEnterpriseCount,
        roi,
        roi_unit: '每亿元财政投入收益企业数',
        effect_direction: didEffect >= 0 ? 'positive' : 'negative',
        policy_bucket: policyBucket,
        scenario_summary: `担保${parseInt(guaranteeRate, 10)}% / 利率优惠${interestOffset.toFixed(2)}% / 补贴等级${subsidyLevel}`,
        risk_warnings: [
            guaranteeRate > 20 ? '担保拨备率过高可能引发地方财政流动性压力' : null,
            Math.abs(interestOffset) > 1.0 ? '利率降幅超过1%需关注银行净息差压缩' : null,
            subsidyLevel >= 3 ? '高补贴覆盖需配合中央专项债使用' : null
        ],
        prediction_months: ['25-01', '25-02', '25-03'],
        prediction_values: (() => {
            const stepReduction = (currentNpl - predictedNpl) / 3;
            return [1, 2, 3].map(step => Number((currentNpl - stepReduction * step).toFixed(2)));
        })(),
        policy_tools: [
            {
                name: '政府担保拨备',
                intensity: guaranteeRate >= 20 ? '高强度' : (guaranteeRate >= 12 ? '增强' : '基础'),
                rationale: '通过提高风险分担比例，释放银行对制造业及配套小微企业的授信意愿。'
            },
            {
                name: '利率优惠传导',
                intensity: Math.abs(interestOffset) >= 1.1 ? '显著' : (Math.abs(interestOffset) >= 0.6 ? '中等' : '温和'),
                rationale: '压降融资成本，缓释转贷压力，对现金流脆弱企业形成短期托底。'
            },
            {
                name: '产业补贴覆盖',
                intensity: ['低', '中', '高'][Math.max(0, Math.min(subsidyLevel - 1, 2))],
                rationale: '用于技改、订单恢复和就业稳定，提升政策覆盖面的可见度。'
            }
        ],
        transmission_paths: [
            {
                stage: '金融供给侧',
                impact: `担保拨备提升至 ${parseInt(guaranteeRate, 10)}%，银行风险暴露下降，授信意愿增强。`
            },
            {
                stage: '企业融资侧',
                impact: `利率优惠 ${interestOffset.toFixed(2)}% 带动转贷与续贷成本下降，并与担保、补贴协同形成 ${didEffect.toFixed(3)} 的综合政策效应。`
            },
            {
                stage: '产业经营侧',
                impact: `补贴等级 ${subsidyLevel} 主要作用于技改、订单修复和稳岗，改善产业链核心节点现金流。`
            }
        ],
        target_segments: [
            '制造业配套小微企业',
            '供应链上游原材料企业',
            ...(Math.abs(interestOffset) >= 0.8 ? ['短期转贷压力较高的流动性承压企业'] : []),
            ...(subsidyLevel >= 2 ? ['处于技改或订单修复阶段的产业集群'] : []),
            ...(guaranteeRate >= 18 ? ['担保依赖度较高但订单稳定的首贷户'] : [])
        ],
        implementation_conditions: [
            '需保持财政拨备与担保代偿准备金同步安排。',
            '政策评估应按季度复核不良率与受益企业覆盖面。',
            ...(Math.abs(interestOffset) > 1.0 ? ['需同步监测银行净息差压力，避免出现信用供给收缩。'] : []),
            ...(subsidyLevel >= 3 ? ['建议与专项债、技改贴息等工具协同，避免单一补贴挤出。'] : []),
            ...(guaranteeRate >= 20 ? ['高担保场景下应叠加准入清单与白名单机制，控制财政流动性风险。'] : [])
        ],
        evidence_points: [
            `PSM-DID 估计量为 ${didEffect.toFixed(4)}，用于衡量净政策效应方向与强度。`,
            `单位 ROI 为 ${roi}，口径统一为每亿元财政投入收益企业数。`,
            `预计受益企业 ${benefitEnterpriseCount} 家，可用于答辩时解释覆盖面效果。`
        ],
        scorecard: {
            efficiency_score: efficiencyScore,
            coverage_score: coverageScore,
            implementation_score: implementationScore,
            composite_score: compositeScore
        },
        policy_recommendation: didEffect > 0.5
            ? '当前政策组合预计具有显著正向效应，建议优先在特定产业集群试点推行。'
            : didEffect > 0.2
                ? '政策力度适中，建议结合地方财政承受能力逐步推广。'
                : '当前参数调整幅度较小，政策边际效应有限，建议适度加大担保或利率优惠。'
    };
}

function applyDashboardOverview(data) {
    if (data && data.kpis) {
        data.kpis.forEach(kpi => {
            const valEl = document.getElementById(`kpi-${kpi.id}`);
            if (valEl) {
                let valStr = kpi.value;
                if (kpi.id === 'npl') valStr = `${kpi.value}<span class="kpi-unit">%</span>`;
                valEl.innerHTML = `${valStr}<span class="kpi-trend ${kpi.direction}">
                    <i class="fa-solid fa-arrow-${kpi.direction}"></i> ${kpi.trend}</span>`;
            }
        });
    }

    if (data?.radar_data) renderRadarChart(data.radar_data);
}

function formatRawValue(value, unit) {
    if (value === null || value === undefined || value === '') return `未披露${unit ? ` (${unit})` : ''}`;
    if (typeof value === 'number') {
        return `${value.toLocaleString('zh-CN')}${unit ? ` ${unit}` : ''}`;
    }
    return `${value}${unit ? ` ${unit}` : ''}`;
}

function renderRawSearchResults(payload) {
    const container = document.getElementById('scene-search-results');
    const statusEl = document.getElementById('scene-search-status');
    if (!container) return;

    if (!payload || !Array.isArray(payload.results) || payload.results.length === 0) {
        if (statusEl) {
            statusEl.innerText = payload?.message || '未检索到匹配记录，请更换关键词重试。';
        }
        const guide = payload?.filters?.city && payload?.filters?.industry
            ? '建议优先切换为“规模以上工业”，或先将城市改为“全部城市”再查看该行业。'
            : '建议放宽年份条件，或切换到当前底表覆盖更充分的主行业后再检索。';
        container.innerHTML = `
            <div class="raw-search-placeholder">
                <strong>${payload?.message || '未检索到匹配记录。'}</strong>
                <span>${guide}</span>
            </div>
        `;
        return;
    }

    if (statusEl) {
        statusEl.innerText = `${payload.message} 当前样本库版本：${payload.dataset?.version || 'v0.1'}。`;
    }

    const cards = payload.results.map(item => {
        const locationTag = item.city ? `${item.province} · ${item.city}` : item.province;
        const yoyTag = item.yoy_pct !== null && item.yoy_pct !== undefined
            ? `<span class="raw-result-tag">同比 ${item.yoy_pct}%</span>`
            : '';
        return `
            <div class="raw-result-card">
                <div class="raw-result-meta">
                    <span class="raw-result-origin"><i class="fa-solid fa-shield-halved"></i> ${item.source_org}</span>
                    <span>${locationTag} · ${item.period}</span>
                </div>
                <div class="raw-result-title">${item.industry} · ${item.indicator}</div>
                <div class="raw-result-value">
                    <strong>${formatRawValue(item.value, item.unit)}</strong>
                </div>
                <div class="raw-result-tags">
                    <span class="raw-result-tag">${item.category}</span>
                    <span class="raw-result-tag">${item.frequency}</span>
                    ${yoyTag}
                </div>
                <div class="raw-result-source">
                    <div>${locationTag} · ${item.source_title}</div>
                    <a href="${item.source_url}" target="_blank" rel="noopener noreferrer">查看官方来源</a>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="raw-search-summary">
            <span>省份：<strong>${payload.filters?.province || '全部'}</strong></span>
            <span>城市：<strong>${payload.filters?.city || '全部城市'}</strong></span>
            <span>行业：<strong>${payload.filters?.industry || '全部行业'}</strong></span>
            <span>年份：<strong>${payload.year === 'older' ? '2023及以前' : (payload.year || 'all') === 'all' ? '全部年份' : payload.year}</strong></span>
            <span>共匹配 <strong>${payload.total}</strong> 条，当前已展示 <strong>${payload.results.length}</strong> 条</span>
            <span>数据集：<strong>${payload.dataset?.dataset_name || 'guangdong_official_raw_data'}</strong></span>
        </div>
        <div class="raw-search-scroll">
            <div class="raw-search-grid">${cards}</div>
        </div>
    `;
}

function getRawSearchFilters() {
    return {
        province: document.getElementById('scene-search-province')?.value || '',
        city: document.getElementById('scene-search-city')?.value || '',
        industry: document.getElementById('scene-search-industry')?.value || '',
        year: document.getElementById('scene-search-year')?.value || 'all'
    };
}

async function refreshDashboardOverviewByFilters(filters) {
    const params = new URLSearchParams({
        province: filters.province || '',
        city: filters.city || '',
        industry: filters.industry || '',
        year: filters.year || 'all'
    });

    const data = await fetchData(`/dashboard/overview?${params.toString()}`, dashboardBaseOverview || {
        kpis: mockData.kpis,
        radar_data: [
            {name: "经济景气", value: 86, max: 100},
            {name: "行业健康", value: 78, max: 100},
            {name: "普惠环境", value: 82, max: 100},
            {name: "小微经营", value: 71, max: 100},
            {name: "信用环境", value: 75, max: 100},
            {name: "政策效力", value: 92, max: 100}
        ]
    });

    applyDashboardOverview(data);
}

function fillSelectOptions(selectEl, options, placeholder, selectedValue = '') {
    if (!selectEl) return;
    const items = [`<option value="">${placeholder}</option>`];
    options.forEach(option => {
        const selected = option === selectedValue ? 'selected' : '';
        items.push(`<option value="${option}" ${selected}>${option}</option>`);
    });
    selectEl.innerHTML = items.join('');
}

function syncSceneSearchSelectState(selectEl) {
    if (!selectEl) return;
    const hasValue = Boolean(selectEl.value && selectEl.value !== 'all');
    selectEl.classList.toggle('has-value', hasValue);
}

async function initRawDataSelectors() {
    const provinceEl = document.getElementById('scene-search-province');
    const cityEl = document.getElementById('scene-search-city');
    const industryEl = document.getElementById('scene-search-industry');
    const yearEl = document.getElementById('scene-search-year');
    const statusEl = document.getElementById('scene-search-status');
    if (!provinceEl || !cityEl || !industryEl) return;

    const payload = await fetchData('/data/options', {
        provinces: ['广东'],
        cities: [],
        industries: [],
        dataset: { version: 'v0.1' }
    });

    const provinces = payload?.provinces || ['广东'];
    const cities = payload?.cities || [];
    const industries = payload?.industries || [];

    fillSelectOptions(provinceEl, provinces, '选择省份', provinces.includes('广东') ? '广东' : '');
    fillSelectOptions(cityEl, cities, '全部城市');
    fillSelectOptions(industryEl, industries, '全部行业');
    [provinceEl, cityEl, industryEl, yearEl].forEach(syncSceneSearchSelectState);

    if (statusEl && payload?.dataset?.version) {
        statusEl.innerText = `当前数据底座：广东省官方公开统计样本库，当前样本库版本：${payload.dataset.version}。`;
    }

    await refreshDashboardOverviewByFilters(getRawSearchFilters());
}

async function runRawDataSearch() {
    const filters = getRawSearchFilters();
    const provinceValue = filters.province;
    const cityValue = filters.city;
    const industryValue = filters.industry;
    const statusEl = document.getElementById('scene-search-status');
    const container = document.getElementById('scene-search-results');
    const yearValue = filters.year;
    if (!provinceValue && !cityValue && !industryValue && yearValue === 'all') {
        renderRawSearchResults({
            message: '请选择省份、城市、行业或年份进行检索。',
            results: [],
            filters
        });
        return;
    }

    if (statusEl) {
        statusEl.innerText = `正在检索 ${provinceValue || '广东样本库'} ${cityValue || ''} ${industryValue || ''} ${yearValue !== 'all' ? `（${yearValue === 'older' ? '2023及以前' : yearValue}）` : ''} 对应的官方原始数据...`;
    }
    if (container) {
        container.innerHTML = `<div class="raw-search-placeholder">正在检索中，请稍候...</div>`;
    }

    const params = new URLSearchParams({
        limit: '500',
        year: yearValue,
        province: provinceValue,
        city: cityValue,
        industry: industryValue
    });

    const payload = await fetchData(`/data/search?${params.toString()}`, {
        query: '',
        filters,
        total: 0,
        results: [],
        dataset: { dataset_name: 'guangdong_official_raw_data', version: 'v0.1' },
        message: '当前后端检索接口不可用。'
    });
    renderRawSearchResults(payload);
    await refreshDashboardOverviewByFilters(filters);
}

function buildLocalIndustryGraph(industry = 'manufacturing') {
    const industryMeta = {
        manufacturing: {
            industry: 'manufacturing',
            industry_summary: '制造业链条呈现“核心企业订单修复、上游账期偏长、下游回款分化”的传导特征，适合采用担保增信 + 利率优惠 + 技改补贴的组合策略。',
            policy_hint: '优先锁定现金流承压且订单稳定的链上节点，先稳融资再稳产能。',
            focus_node_id: '2'
        },
        retail: {
            industry: 'retail',
            industry_summary: '批发零售链条对消费景气和库存周转更敏感，应侧重周转类流贷支持和终端补贴拉动。',
            policy_hint: '优先缓解终端经销与仓储节点的短期流动性冲击。',
            focus_node_id: '4'
        },
        service: {
            industry: 'service',
            industry_summary: '服务业链条轻资产、现金流波动更快，宜通过贴息与信用担保稳定经营性现金流。',
            policy_hint: '优先覆盖吸纳就业较多但抗冲击能力较弱的服务节点。',
            focus_node_id: '3'
        }
    };
    const activeMeta = industryMeta[industry] || industryMeta.manufacturing;
    return {
        ...activeMeta,
        nodes: [
            {
                id: '0',
                name: '区域政策银行',
                symbolSize: 45,
                category: 0,
                risk_level: '低',
                risk_score: 34,
                description: '承担普惠转贷和续贷支持，是链上融资供给入口。',
                policy_focus: '维持定向利率优惠并扩大首贷覆盖。',
                recommended_adjustments: { guarantee_rate_delta: 2, interest_offset_delta: -0.3, subsidy_level_delta: 0 }
            },
            {
                id: '1',
                name: '核心制造企业A',
                symbolSize: 35,
                category: 1,
                risk_level: '中',
                risk_score: 58,
                description: '订单修复中但对上下游回款传导敏感，是产业链信用锚点。',
                policy_focus: '强化担保增信并配置中等补贴，稳住核心订单与票据周转。',
                recommended_adjustments: { guarantee_rate_delta: 5, interest_offset_delta: -0.4, subsidy_level_delta: 1 }
            },
            {
                id: '2',
                name: '上游供应商B',
                symbolSize: 22,
                category: 2,
                risk_level: '高',
                risk_score: 82,
                description: '应收账款回收周期偏长，原料采购对短贷依赖度高。',
                policy_focus: '优先加大利率优惠与担保比例，缓解短期转贷压力。',
                recommended_adjustments: { guarantee_rate_delta: 8, interest_offset_delta: -0.7, subsidy_level_delta: 1 }
            },
            {
                id: '3',
                name: '上游供应商C',
                symbolSize: 22,
                category: 2,
                risk_level: '中高',
                risk_score: 71,
                description: '现金流受订单波动影响明显，需技改资金与稳岗支持并行。',
                policy_focus: '适度提高补贴覆盖，配合担保缓释现金流缺口。',
                recommended_adjustments: { guarantee_rate_delta: 6, interest_offset_delta: -0.5, subsidy_level_delta: 2 }
            },
            {
                id: '4',
                name: '下游经销商D',
                symbolSize: 28,
                category: 3,
                risk_level: '中',
                risk_score: 63,
                description: '回款受终端消费波动影响，库存周转阶段性承压。',
                policy_focus: '以贴息和阶段性补贴稳定终端需求恢复。',
                recommended_adjustments: { guarantee_rate_delta: 3, interest_offset_delta: -0.6, subsidy_level_delta: 1 }
            },
            {
                id: '5',
                name: '地方担保机构',
                symbolSize: 38,
                category: 0,
                risk_level: '低',
                risk_score: 41,
                description: '承担风险缓释与财政协同角色，是政策落地的中枢节点。',
                policy_focus: '需同步补充代偿准备金和白名单准入机制。',
                recommended_adjustments: { guarantee_rate_delta: 4, interest_offset_delta: -0.2, subsidy_level_delta: 0 }
            },
            {
                id: '6',
                name: '原材料供应商E',
                symbolSize: 18,
                category: 2,
                risk_level: '高',
                risk_score: 76,
                description: '原材料价格波动放大了资金占用，账期和库存风险同步上升。',
                policy_focus: '建议叠加贴息与补贴，降低补库成本和经营波动。',
                recommended_adjustments: { guarantee_rate_delta: 5, interest_offset_delta: -0.8, subsidy_level_delta: 2 }
            }
        ],
        links: [
            { source: '0', target: '1', value: 0.88, risk_type: '授信供给', explanation: '政策银行授信意愿直接决定核心企业票据与流贷可得性。' },
            { source: '5', target: '1', value: 0.74, risk_type: '担保增信', explanation: '担保覆盖率提升可显著缓释核心企业首贷与续贷门槛。' },
            { source: '1', target: '2', value: 0.91, risk_type: '订单拖欠', explanation: '核心企业回款节奏变化会快速传导至上游账期。' },
            { source: '1', target: '3', value: 0.79, risk_type: '产能协同', explanation: '技改与订单修复会影响配套供应商现金流稳定性。' },
            { source: '1', target: '4', value: 0.68, risk_type: '渠道分销', explanation: '下游经销回款决定链条资金回流速度。' },
            { source: '2', target: '6', value: 0.83, risk_type: '原料价格', explanation: '原材料价格与库存波动会放大上游资金占用压力。' },
            { source: '0', target: '5', value: 0.57, risk_type: '财政协同', explanation: '金融机构与担保机构协同决定政策工具的落地效率。' }
        ],
        categories: [
            { name: '金融机构' },
            { name: '核心企业' },
            { name: '上游产业' },
            { name: '下游产业' }
        ]
    };
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function getProvinceScenario(provinceName) {
    const normalizedName = String(provinceName || '').replace(/(省|市|自治区|维吾尔自治区|壮族自治区|回族自治区)$/, '').trim();
    if (regionScenarioLibrary[normalizedName]) {
        return regionScenarioLibrary[normalizedName];
    }
    const mapEntry = mockData.mapData.find(d => normalizedName.includes(d.name) || d.name.includes(normalizedName));
    const creditVal = mapEntry ? mapEntry.value : 65;
    return {
        province: normalizedName || '区域样本',
        credit: creditVal,
        micro: Math.round(creditVal * 0.86),
        npl: Number((3.45 - creditVal * 0.015).toFixed(2)),
        policyPack: '均衡增信 + 定向贴息',
        policyDesc: '优先稳住区域小微主体流动性',
        creditDesc: '区域信用环境处于中性修复区间',
        microDesc: '小微经营健康需结合产业结构持续观察',
        industryDistribution: [
            { name: '制造业', value: 30 },
            { name: '批发零售', value: 24 },
            { name: '建筑业', value: 18 },
            { name: '农林牧渔', value: 16 },
            { name: '其他', value: 12 }
        ],
        riskFactors: [
            { name: '宏观经济波动', value: 28 },
            { name: '产业链信用传导', value: 24 },
            { name: '流动性风险', value: 21 },
            { name: '政策合规风险', value: 15 },
            { name: '外部冲击', value: 12 }
        ],
        insights: [
            '该区域信用与经营指标处于中性区间，需结合链上行业特征制定扶持策略。',
            '更适合采用分层扶持思路，避免单一政策工具过度集中。',
            '建议将信用增信与区域产业引导协同推进。'
        ]
    };
}

function calculateRecommendationScore(result) {
    if (result.scorecard?.composite_score) {
        return result.scorecard.composite_score;
    }
    return result.roi * 0.5 + (result.benefit_enterprise_count / 1000) * 0.5;
}

function renderPolicyTools(items = []) {
    return items.map(item =>
        `<div class="policy-chip"><strong>${item.name}</strong><span>${item.intensity}</span><em>${item.rationale}</em></div>`
    ).join('');
}

function renderBulletList(items = [], icon = 'fa-circle') {
    return items.map(item =>
        `<li><i class="fa-solid ${icon}"></i><span>${item}</span></li>`
    ).join('');
}

function renderPathList(items = []) {
    return items.map(item =>
        `<li><strong>${item.stage}</strong><span>${item.impact}</span></li>`
    ).join('');
}

function renderScorecard(scorecard = {}) {
    return `
        <div class="score-grid">
            <div class="score-item"><span>效率评分</span><strong>${scorecard.efficiency_score ?? '--'}</strong></div>
            <div class="score-item"><span>覆盖评分</span><strong>${scorecard.coverage_score ?? '--'}</strong></div>
            <div class="score-item"><span>实施评分</span><strong>${scorecard.implementation_score ?? '--'}</strong></div>
            <div class="score-item accent"><span>综合评分 <small>(效率40% + 覆盖35% + 实施25%)</small></span><strong>${scorecard.composite_score ?? '--'}</strong></div>
        </div>
    `;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function renderReportList(items = []) {
    return items.map(item => `<li>${escapeHtml(item)}</li>`).join('');
}

function renderReportPathList(items = []) {
    return items.map(item => `<li><strong>${escapeHtml(item.stage)}：</strong>${escapeHtml(item.impact)}</li>`).join('');
}

function renderReportTools(items = []) {
    return items.map(item =>
        `<li><strong>${escapeHtml(item.name)} · ${escapeHtml(item.intensity)}</strong> ${escapeHtml(item.rationale)}</li>`
    ).join('');
}

function renderScorecardBlock(scorecard = {}) {
    return `
        <div class="report-score-grid">
            <div class="report-score"><span>效率评分</span><strong>${escapeHtml(scorecard.efficiency_score ?? '--')}</strong></div>
            <div class="report-score"><span>覆盖评分</span><strong>${escapeHtml(scorecard.coverage_score ?? '--')}</strong></div>
            <div class="report-score"><span>实施评分</span><strong>${escapeHtml(scorecard.implementation_score ?? '--')}</strong></div>
            <div class="report-score"><span>综合评分</span><strong>${escapeHtml(scorecard.composite_score ?? '--')}</strong></div>
        </div>
    `;
}

function renderComparisonRows(comparison) {
    if (!comparison) return '';
    return `
        <tr>
            <td>情景 A</td>
            <td>${escapeHtml(comparison.resultA.scenario_summary)}</td>
            <td>${escapeHtml(comparison.resultA.predicted_npl)}%</td>
            <td>${escapeHtml(comparison.resultA.benefit_enterprise_count)}</td>
            <td>${escapeHtml(comparison.resultA.scorecard?.composite_score ?? '--')}</td>
        </tr>
        <tr>
            <td>情景 B</td>
            <td>${escapeHtml(comparison.resultB.scenario_summary)}</td>
            <td>${escapeHtml(comparison.resultB.predicted_npl)}%</td>
            <td>${escapeHtml(comparison.resultB.benefit_enterprise_count)}</td>
            <td>${escapeHtml(comparison.resultB.scorecard?.composite_score ?? '--')}</td>
        </tr>
    `;
}

function renderIndustryContextBlock(selection) {
    if (!selection) return '';
    return `
        <div class="report-section">
            <h2>产业链定向定位</h2>
            <div class="report-card">
                <p><strong>锁定节点：</strong>${escapeHtml(selection.node_name)}</p>
                <p><strong>风险等级：</strong>${escapeHtml(selection.risk_level)} / 风险分值 ${escapeHtml(selection.risk_score)}</p>
                <p><strong>产业链特征：</strong>${escapeHtml(selection.industry_summary)}</p>
                <p><strong>节点说明：</strong>${escapeHtml(selection.description)}</p>
                <p><strong>政策焦点：</strong>${escapeHtml(selection.policy_focus)}</p>
                <p><strong>联动提示：</strong>${escapeHtml(selection.policy_hint)}</p>
            </div>
        </div>
    `;
}

function renderIndustryAppendixBlock(industryKey) {
    const data = industryScenarioLibrary[industryKey];
    if (!data) return '';
    return `
        <div class="report-section">
            <h2>行业演化附件</h2>
            <div class="report-grid">
                <div class="report-card">
                    <h3>${escapeHtml(data.label)} 行业摘要</h3>
                    <ul class="report-list">
                        <li><strong>行业风险等级：</strong>${escapeHtml(data.riskLevel)} / 风险分值 ${escapeHtml(data.riskScore)}</li>
                        <li><strong>主压力量纲：</strong>${escapeHtml(data.mainDriver)}</li>
                        <li><strong>建议政策方向：</strong>${escapeHtml(data.policyFocus)}</li>
                    </ul>
                </div>
                <div class="report-card">
                    <h3>行业演化结论</h3>
                    <ul class="report-list">${renderReportList(data.insights || [])}</ul>
                </div>
            </div>
        </div>
    `;
}

function renderRegionAppendixBlock(regionKey) {
    const data = getProvinceScenario(regionKey);
    if (!data) return '';
    return `
        <div class="report-section">
            <h2>区域下钻附件</h2>
            <div class="report-grid">
                <div class="report-card">
                    <h3>${escapeHtml(data.province)} 区域画像</h3>
                    <ul class="report-list">
                        <li><strong>信用环境：</strong>${escapeHtml(data.credit)}</li>
                        <li><strong>小微经营健康：</strong>${escapeHtml(data.micro)}</li>
                        <li><strong>不良率画像：</strong>${escapeHtml(data.npl)}%</li>
                        <li><strong>建议政策组合：</strong>${escapeHtml(data.policyPack)}</li>
                    </ul>
                </div>
                <div class="report-card">
                    <h3>区域诊断摘要</h3>
                    <ul class="report-list">${renderReportList(data.insights || [])}</ul>
                </div>
            </div>
        </div>
    `;
}

function buildPrintReportHtml() {
    const policy = reportState.latestPolicyResult;
    const comparison = reportState.comparison;
    const industrySelection = reportState.industrySelection;
    const activeView = reportState.activeView || 'dashboard';
    const now = new Date().toLocaleString('zh-CN', { hour12: false });
    const appendixSource = activeView === 'trend'
        ? `行业演化视图 · ${industryScenarioLibrary[currentIndustryView]?.label || currentIndustryView}`
        : activeView === 'map'
            ? `区域下钻规划 · ${currentRegionView}`
            : activeView === 'policy'
                ? '政策模拟平台（见核心结论章节）'
                : '综合驾驶舱';

    if (!policy) {
        return `
            <div class="report-shell">
                <div class="report-header">
                    <div>
                        <h1 class="report-title">普惠金融政策建议报告</h1>
                        <p class="report-subtitle">当前尚未生成政策模拟结果。请先在驾驶舱或对比页运行一次政策推演，再导出报告。</p>
                    </div>
                    <div class="report-meta">
                        <div><strong>生成时间：</strong>${escapeHtml(now)}</div>
                    </div>
                </div>
            </div>
        `;
    }

    const comparisonBlock = comparison ? `
        <div class="report-section">
            <h2>情景对比结论</h2>
            <div class="report-card report-highlight">
                <p><strong>推荐情景：</strong>${escapeHtml(comparison.betterScenario)}</p>
                <p><strong>推荐理由：</strong>${escapeHtml(comparison.summary)}</p>
            </div>
            <div class="report-grid">
                <div class="report-card">
                    <h3>情景 A</h3>
                    <ul class="report-list">
                        <li><strong>方案摘要：</strong>${escapeHtml(comparison.resultA.scenario_summary)}</li>
                        <li><strong>综合评分：</strong>${escapeHtml(comparison.resultA.scorecard?.composite_score ?? '--')}</li>
                        <li><strong>预测不良率：</strong>${escapeHtml(comparison.resultA.predicted_npl)}%</li>
                        <li><strong>受益企业：</strong>${escapeHtml(comparison.resultA.benefit_enterprise_count)}</li>
                    </ul>
                </div>
                <div class="report-card">
                    <h3>情景 B</h3>
                    <ul class="report-list">
                        <li><strong>方案摘要：</strong>${escapeHtml(comparison.resultB.scenario_summary)}</li>
                        <li><strong>综合评分：</strong>${escapeHtml(comparison.resultB.scorecard?.composite_score ?? '--')}</li>
                        <li><strong>预测不良率：</strong>${escapeHtml(comparison.resultB.predicted_npl)}%</li>
                        <li><strong>受益企业：</strong>${escapeHtml(comparison.resultB.benefit_enterprise_count)}</li>
                    </ul>
                </div>
            </div>
        </div>
    ` : '';
    const warningsBlock = (policy.risk_warnings || []).filter(Boolean).length > 0 ? `
        <div class="report-section">
            <h2>风险提示</h2>
            <div class="report-card">
                <ul class="report-list">${renderReportList((policy.risk_warnings || []).filter(Boolean))}</ul>
            </div>
        </div>
    ` : '';
    const industryBlock = renderIndustryContextBlock(industrySelection);
    const activeAppendixBlock = activeView === 'trend'
        ? renderIndustryAppendixBlock(currentIndustryView)
        : activeView === 'map'
            ? renderRegionAppendixBlock(currentRegionView)
            : '';

    return `
        <div class="report-shell">
            <div class="report-header">
                <div>
                    <span class="report-kicker">INCLUSIVE FINANCE DECISION BRIEF</span>
                    <h1 class="report-title">普惠金融政策建议报告</h1>
                    <p class="report-subtitle">本报告基于当前驾驶舱中的 PSM-DID 政策模拟结果自动生成，用于路演、答辩和政策方案说明。</p>
                </div>
                <div class="report-meta">
                    <div><strong>生成时间：</strong>${escapeHtml(now)}</div>
                    <div><strong>方案类型：</strong>${escapeHtml(policy.policy_bucket)}</div>
                    <div><strong>方案摘要：</strong>${escapeHtml(policy.scenario_summary)}</div>
                    <div><strong>ROI 口径：</strong>${escapeHtml(policy.roi_unit)}</div>
                    <div><strong>附件来源：</strong>${escapeHtml(appendixSource)}</div>
                </div>
            </div>

            <div class="report-section">
                <h2>执行摘要</h2>
                <div class="report-summary-grid">
                    <div class="report-metric"><span>方案类型</span><strong>${escapeHtml(policy.policy_bucket)}</strong></div>
                    <div class="report-metric"><span>预测不良率</span><strong>${escapeHtml(policy.predicted_npl)}%</strong></div>
                    <div class="report-metric"><span>受益企业数</span><strong>${escapeHtml(policy.benefit_enterprise_count)}</strong></div>
                    <div class="report-metric"><span>单位 ROI</span><strong>${escapeHtml(policy.roi)}</strong></div>
                </div>
            </div>

            <div class="report-section">
                <h2>核心结论</h2>
                <div class="report-card report-highlight">
                    <p><strong>政策建议：</strong>${escapeHtml(policy.policy_recommendation)}</p>
                    <p><strong>结果概览：</strong>预计不良率由 ${escapeHtml(policy.current_npl)}% 下降至 ${escapeHtml(policy.predicted_npl)}%，带动 ${escapeHtml(policy.benefit_enterprise_count)} 家小微企业受益，单位 ROI 为 ${escapeHtml(policy.roi)}。</p>
                </div>
            </div>
            ${industryBlock}

            <div class="report-section">
                <h2>评分卡</h2>
                ${renderScorecardBlock(policy.scorecard)}
            </div>

            <div class="report-section">
                <h2>关键指标摘要</h2>
                <div class="report-card">
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>指标</th>
                                <th>当前值</th>
                                <th>解释</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>DID 估计量</td>
                                <td>${escapeHtml(policy.did_estimate)}</td>
                                <td>衡量政策组合的净效应方向与强度。</td>
                            </tr>
                            <tr>
                                <td>财政成本</td>
                                <td>${escapeHtml(policy.fiscal_cost_billion)} 亿</td>
                                <td>按照担保拨备与补贴覆盖等级估算财政投入压力。</td>
                            </tr>
                            <tr>
                                <td>单位 ROI</td>
                                <td>${escapeHtml(policy.roi)}</td>
                                <td>${escapeHtml(policy.roi_unit)}</td>
                            </tr>
                            <tr>
                                <td>综合评分</td>
                                <td>${escapeHtml(policy.scorecard?.composite_score ?? '--')}</td>
                                <td>由效率、覆盖和实施三项指标加权形成。</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="report-section">
                <h2>政策工具组合</h2>
                <div class="report-card">
                    <ul class="report-list">${renderReportTools(policy.policy_tools || [])}</ul>
                </div>
            </div>

            <div class="report-section">
                <h2>传导路径与适用对象</h2>
                <div class="report-grid">
                    <div class="report-card">
                        <h3>作用路径</h3>
                        <ul class="report-list">${renderReportPathList(policy.transmission_paths || [])}</ul>
                    </div>
                    <div class="report-card">
                        <h3>适用对象</h3>
                        <ul class="report-list">${renderReportList(policy.target_segments || [])}</ul>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h2>实施约束与证据链</h2>
                <div class="report-grid">
                    <div class="report-card">
                        <h3>执行约束</h3>
                        <ul class="report-list">${renderReportList(policy.implementation_conditions || [])}</ul>
                    </div>
                    <div class="report-card">
                        <h3>决策证据</h3>
                        <ul class="report-list">${renderReportList(policy.evidence_points || [])}</ul>
                    </div>
                </div>
            </div>

            ${warningsBlock}
            ${activeAppendixBlock}
            ${comparisonBlock}

            ${comparison ? `
                <div class="report-section">
                    <h2>对比摘要表</h2>
                    <div class="report-card">
                        <table class="report-table">
                            <thead>
                                <tr>
                                    <th>情景</th>
                                    <th>方案摘要</th>
                                    <th>预测不良率</th>
                                    <th>受益企业</th>
                                    <th>综合评分</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${renderComparisonRows(comparison)}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}

            <div class="report-footer">
                本报告基于结构化模拟数据与 PSM-DID/LSTM 方法论框架自动生成，数据口径参照国家统计局、央行及银保监公开报表结构，适用于路演展示与方案说明。
            </div>
        </div>
    `;
}

function buildPrintDocumentHtml(reportHtml) {
    return `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>普惠金融政策建议报告</title>
            <style>
                :root {
                    color-scheme: light;
                }
                * {
                    box-sizing: border-box;
                }
                body {
                    margin: 0;
                    background: #ffffff;
                    color: #0f172a;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
                }
                .report-shell {
                    background: #ffffff;
                    color: #0f172a;
                    min-height: 100vh;
                    padding: 32px 36px;
                }
                .report-header {
                    display: flex;
                    justify-content: space-between;
                    gap: 24px;
                    padding-bottom: 18px;
                    border-bottom: 2px solid #dbeafe;
                    margin-bottom: 20px;
                }
                .report-title {
                    font-size: 28px;
                    color: #0f172a;
                    margin: 0 0 8px;
                }
                .report-subtitle {
                    color: #475569;
                    line-height: 1.7;
                    max-width: 720px;
                    margin: 0;
                }
                .report-meta {
                    min-width: 220px;
                    display: grid;
                    gap: 8px;
                    font-size: 13px;
                    color: #475569;
                }
                .report-meta strong,
                .report-card strong,
                .report-table th,
                .report-section h2,
                .report-title,
                .report-card h3 {
                    color: #0f172a;
                }
                .report-kicker {
                    display: inline-block;
                    font-size: 12px;
                    letter-spacing: 1.2px;
                    color: #2563eb;
                    margin-bottom: 10px;
                }
                .report-section {
                    margin-top: 24px;
                    break-inside: avoid;
                    page-break-inside: avoid;
                }
                .report-section h2 {
                    font-size: 18px;
                    margin: 0 0 12px;
                }
                .report-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 14px;
                }
                .report-card {
                    border: 1px solid #dbeafe;
                    border-radius: 10px;
                    background: #f8fbff;
                    padding: 14px 16px;
                    break-inside: avoid;
                    page-break-inside: avoid;
                }
                .report-card h3 {
                    font-size: 14px;
                    margin: 0 0 8px;
                }
                .report-card p,
                .report-card li {
                    color: #475569;
                    line-height: 1.7;
                    font-size: 13px;
                }
                .report-summary-grid,
                .report-score-grid {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 12px;
                }
                .report-metric,
                .report-score {
                    border: 1px solid #dbeafe;
                    border-radius: 10px;
                    background: #ffffff;
                    padding: 14px;
                }
                .report-metric span,
                .report-score span {
                    display: block;
                    color: #64748b;
                    font-size: 12px;
                    margin-bottom: 8px;
                }
                .report-metric strong,
                .report-score strong {
                    display: block;
                    color: #0f172a;
                    font-size: 20px;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
                }
                .report-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 13px;
                }
                .report-table th,
                .report-table td {
                    padding: 10px 12px;
                    border: 1px solid #dbeafe;
                    text-align: left;
                    vertical-align: top;
                }
                .report-table th {
                    background: #eff6ff;
                }
                .report-footer {
                    margin-top: 28px;
                    padding-top: 14px;
                    border-top: 1px solid #dbeafe;
                    color: #64748b;
                    font-size: 12px;
                    line-height: 1.7;
                }
                .report-list {
                    list-style: none;
                    display: grid;
                    gap: 8px;
                    padding: 0;
                    margin: 0;
                }
                .report-list li {
                    display: flex;
                    gap: 8px;
                }
                .report-list li::before {
                    content: "•";
                    color: #2563eb;
                    flex: 0 0 auto;
                }
                .report-highlight {
                    border-left: 4px solid #10b981;
                    padding-left: 14px;
                    background: #f0fdf4;
                }
                a {
                    color: #2563eb;
                    text-decoration: none;
                }
                @page {
                    size: A4 portrait;
                    margin: 14mm;
                }
            </style>
        </head>
        <body>
            ${reportHtml}
        </body>
        </html>
    `;
}

function exportDecisionReport() {
    let reportHtml = '';
    try {
        reportHtml = buildPrintReportHtml();
    } catch (e) {
        console.error('[Report] 报告生成失败', e);
        return;
    }
    const existingFrame = document.getElementById('report-print-frame');
    existingFrame?.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'report-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');

    iframe.onload = () => {
        const frameWindow = iframe.contentWindow;
        if (!frameWindow) return;
        setTimeout(() => {
            frameWindow.focus();
            frameWindow.print();
            setTimeout(() => iframe.remove(), 1000);
        }, 300);
    };

    document.body.appendChild(iframe);
    iframe.srcdoc = buildPrintDocumentHtml(reportHtml);
}

// ============================================================
// 实时时钟
// ============================================================
function updateTime() {
    const now = new Date();
    document.getElementById('current-time').innerText = now.toLocaleString('zh-CN', { hour12: false });
}
setInterval(updateTime, 1000);
updateTime();

// ============================================================
// 滚动预警 Ticker
// ============================================================
let tickerIndex = 0;
let tickerMessages = mockData.tickerMessages; // Fallback

(async () => {
    const data = await fetchData('/ticker', null);
    if (data && data.messages) tickerMessages = data.messages;
})();

setInterval(() => {
    tickerIndex = (tickerIndex + 1) % tickerMessages.length;
    const tickerText = document.getElementById('ticker-text');
    tickerText.style.opacity = 0;
    setTimeout(() => {
        tickerText.innerText = tickerMessages[tickerIndex];
        tickerText.style.opacity = 1;
    }, 500);
}, 5000);

function activateView(viewName, options = {}) {
    reportState.activeView = viewName;
    window.scrollTo({ top: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'auto' });
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.toggle('active', nav.dataset.view === viewName);
    });
    document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
    const targetViewId = `view-${viewName}`;
    const targetView = document.getElementById(targetViewId);
    if (targetView) targetView.classList.add('active');

    const activeNav = document.querySelector(`.nav-item[data-view="${viewName}"]`);
    const titleEl = document.getElementById('view-title');
    if (titleEl && activeNav) {
        titleEl.innerText = activeNav.textContent.trim();
    }

    if (viewName === 'trend' && options.industry) {
        currentIndustryView = options.industry;
    }
    if (viewName === 'map' && options.province) {
        currentRegionView = options.province;
    }

    setTimeout(() => {
        if (targetView) targetView.scrollTop = 0;
        if (targetViewId === 'view-trend') {
            renderIndustryEvolutionView(currentIndustryView);
        } else if (targetViewId === 'view-map') {
            renderRegionPlanningView(currentRegionView);
        }
        window.dispatchEvent(new Event('resize'));
        compareChart?.resize();
        compareTrendChart?.resize();
    }, 100);
}

// ============================================================
// 过场加载动画
// ============================================================
window.addEventListener('load', () => {
    let progress = 0;
    const bar = document.getElementById('loader-bar');
    const textWrapper = document.getElementById('loader-text');
    const loadingSteps = [
        { threshold: 20, text: "连接多源异构底层数据库..." },
        { threshold: 45, text: "装载风控神经网络模型权重..." },
        { threshold: 70, text: "校验 AHP/熵权法指标体系..." },
        { threshold: 90, text: "渲染立体呈现空间..." }
    ];
    let stepIdx = 0;

    const seq = setInterval(() => {
        progress += Math.random() * 15 + 3;
        if (progress > 100) progress = 100;
        bar.style.width = progress + '%';

        if (stepIdx < loadingSteps.length && progress >= loadingSteps[stepIdx].threshold) {
            textWrapper.innerText = loadingSteps[stepIdx].text;
            stepIdx++;
        }

        if (progress >= 100) {
            clearInterval(seq);
            setTimeout(() => {
                document.getElementById('loading-screen').style.opacity = '0';
                setTimeout(() => {
                    document.getElementById('loading-screen').style.display = 'none';
                    const mainApp = document.getElementById('app-main');
                    mainApp.style.opacity = '1';
                    mainApp.style.transition = 'opacity 1s ease';
                    document.querySelectorAll('.stagger-up').forEach(el => {
                        el.style.animationPlayState = 'running';
                    });
                }, 800);
            }, 600);
        }
    }, 200);
});

// ============================================================
// 导航路由
// ============================================================
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        activateView(e.currentTarget.dataset.view);
    });
});

document.querySelectorAll('.mini-jump-card').forEach(button => {
    button.addEventListener('click', () => {
        const viewName = button.dataset.jumpView;
        activateView(viewName, {
            industry: button.dataset.industry,
            province: button.dataset.province
        });
    });
});

// ============================================================
// 初始化核心系统 (Init Charts & Data)
// ============================================================
let mapChart, trendChart, relationChart, radarChart;
let industryEvolutionChart, industryDriverHeatmapChart, industryNodeRankingChart;
let regionMapPageChart, regionStructureChart, regionRiskFactorChart;

function updateSimulatorBadges() {
    valGuarantee.innerText = `${simGuarantee.value}%`;
    valRate.innerText = `${parseFloat(simRate.value).toFixed(2)}%`;
    const subsidyValue = parseInt(simSubsidy.value, 10);
    valSubsidy.innerText = subsidyValue === 1 ? '低' : (subsidyValue === 2 ? '中' : '高');
}

function setIndustryLinkPanel(node, graphPayload) {
    const panel = document.getElementById('industry-link-panel');
    if (!panel) return;
    if (!node) {
        panel.innerHTML = `
            <div class="industry-link-kicker">产业定向建议</div>
            <div class="industry-link-title">点击图谱节点，联动生成定向扶持策略</div>
            <div class="industry-link-copy">${escapeHtml(graphPayload?.policy_hint || '系统将根据节点风险等级、传导路径和政策焦点，自动校准担保、利率优惠与补贴覆盖建议。')}</div>
        `;
        return;
    }

    panel.innerHTML = `
        <div class="industry-link-kicker">产业定向建议</div>
        <div class="industry-link-title">${escapeHtml(node.name)} | ${escapeHtml(node.risk_level)}风险 · ${escapeHtml(node.risk_score)}</div>
        <div class="industry-link-copy">${escapeHtml(node.description)}</div>
            <div class="industry-link-grid">
            <div class="industry-link-metric">
                <span>政策焦点</span>
                <strong>${escapeHtml(node.policy_focus)}</strong>
            </div>
            <div class="industry-link-metric">
                <span>建议参数</span>
                <strong>担保 +${escapeHtml(node.recommended_adjustments.guarantee_rate_delta)} / 利率 ${escapeHtml(node.recommended_adjustments.interest_offset_delta)} / 补贴 +${escapeHtml(node.recommended_adjustments.subsidy_level_delta)}</strong>
            </div>
        </div>
    `;
}

function applyIndustryNodePreset(node, graphPayload) {
    if (!node?.recommended_adjustments) return;
    const adjustments = node.recommended_adjustments;
    const nextGuarantee = clamp(parseInt(simGuarantee.value, 10) + adjustments.guarantee_rate_delta, 5, 30);
    const nextRate = clamp(parseFloat(simRate.value) + adjustments.interest_offset_delta, -2, 0);
    const nextSubsidy = clamp(parseInt(simSubsidy.value, 10) + adjustments.subsidy_level_delta, 1, 3);

    simGuarantee.value = String(nextGuarantee);
    simRate.value = nextRate.toFixed(1);
    simSubsidy.value = String(nextSubsidy);
    updateSimulatorBadges();

    activeIndustryNode = node;
    reportState.industrySelection = {
        node_id: node.id,
        node_name: node.name,
        risk_level: node.risk_level,
        risk_score: node.risk_score,
        description: node.description,
        policy_focus: node.policy_focus,
        policy_hint: graphPayload?.policy_hint || '',
        industry_summary: graphPayload?.industry_summary || ''
    };
    setIndustryLinkPanel(node, graphPayload);

    const resultsDiv = document.getElementById('sim-results');
    if (resultsDiv) {
        resultsDiv.innerHTML = `
            <div class="sim-msg highlight"><i class="fa-solid fa-bullseye"></i> 已锁定产业节点: <strong>${node.name}</strong></div>
            <div class="sim-msg"><i class="fa-solid fa-wave-square"></i> 风险等级: <strong>${node.risk_level}</strong> | 风险分值: <strong>${node.risk_score}</strong></div>
            <div class="sim-msg"><i class="fa-solid fa-compass-drafting"></i> 政策焦点: <strong>${node.policy_focus}</strong></div>
            <div class="sim-section">
                <div class="sim-section-title">联动说明</div>
                <ul class="detail-list compact">
                    ${renderBulletList([
                        graphPayload?.industry_summary || '当前产业链条风险正在沿上下游传导。',
                        graphPayload?.policy_hint || '系统已按节点风险自动校准推荐参数。',
                        `已建议调整为担保 ${nextGuarantee}%，利率优惠 ${nextRate.toFixed(1)}%，补贴等级 ${nextSubsidy}。`
                    ], 'fa-link')}
                </ul>
            </div>
            <div class="sim-msg" style="margin-top:8px; color:var(--accent-blue)"><i class="fa-solid fa-lightbulb"></i> 点击“运行 AI 模拟推演”即可生成该节点的定向政策结果。</div>
        `;
    }
}

// 第一步：获取驾驶舱全局概览数据
async function initDashboardOverview() {
    const data = await fetchData('/dashboard/overview', {
        kpis: mockData.kpis, // From mock_data.js
        radar_data: [
            {name: "经济景气", value: 86, max: 100},
            {name: "行业健康", value: 78, max: 100},
            {name: "普惠环境", value: 82, max: 100},
            {name: "小微经营", value: 71, max: 100},
            {name: "信用环境", value: 75, max: 100},
            {name: "政策效力", value: 92, max: 100}
        ]
    });

    dashboardBaseOverview = data;
    applyDashboardOverview(data);

    if (!reportState.latestPolicyResult) {
        reportState.latestPolicyResult = buildLocalPolicyResult(
            parseInt(simGuarantee.value, 10),
            parseFloat(simRate.value),
            parseInt(simSubsidy.value, 10)
        );
    }
}

function renderRadarChart(radarData) {
    const radarContainer = document.getElementById('radarChart');
    if (!radarContainer) return;
    radarChart = echarts.init(radarContainer);
    const isLightTheme = document.body.classList.contains('theme-light-preview');
    const option = {
        radar: {
            indicator: radarData.map(item => ({ name: item.name, max: item.max })),
            radius: '65%',
            splitNumber: 4,
            axisName: {
                color: isLightTheme ? 'rgba(32, 47, 72, 0.74)' : 'rgba(255,255,255,0.7)',
                fontSize: 10,
                fontWeight: 600
            },
            splitLine: {
                lineStyle: {
                    color: isLightTheme ? 'rgba(96, 145, 210, 0.22)' : 'rgba(52, 152, 219, 0.2)'
                }
            },
            splitArea: { show: false },
            axisLine: {
                lineStyle: {
                    color: isLightTheme ? 'rgba(96, 145, 210, 0.22)' : 'rgba(52, 152, 219, 0.2)'
                }
            }
        },
        series: [{
            name: '综合评估',
            type: 'radar',
            data: [{
                value: radarData.map(item => item.value),
                name: '当前现状',
                itemStyle: { color: isLightTheme ? '#4f8fe6' : '#3498db' },
                lineStyle: { color: isLightTheme ? '#4f8fe6' : '#3498db', width: 3 },
                areaStyle: { color: isLightTheme ? 'rgba(79, 143, 230, 0.26)' : 'rgba(52, 152, 219, 0.4)' },
                symbol: 'none'
            }]
        }]
    };
    radarChart.setOption(option);
}

// Evidence Panel Toggle
document.getElementById('btn-evidence')?.addEventListener('click', () => {
    document.getElementById('evidence-panel').style.display = 'flex';
});
document.getElementById('close-evidence')?.addEventListener('click', () => {
    document.getElementById('evidence-panel').style.display = 'none';
});
document.getElementById('evidence-panel')?.addEventListener('click', (e) => {
    if (e.target.id === 'evidence-panel') {
        document.getElementById('evidence-panel').style.display = 'none';
    }
});
document.getElementById('btn-export-report')?.addEventListener('click', () => {
    exportDecisionReport();
});
window.addEventListener('afterprint', () => {
    document.body.classList.remove('print-mode');
});

async function initCharts() {
    // 首先获取概览
    await initDashboardOverview();
    
    // 初始化其他图表
    initMapChart();
    initTrendChart();
    initRelationChart();
    initStageFiveViews();
}

function initStageFiveViews() {
    renderIndustryEvolutionView(currentIndustryView);
    renderRegionPlanningView(currentRegionView);

    document.querySelectorAll('#industry-switcher .segment-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#industry-switcher .segment-btn').forEach(item => item.classList.remove('active'));
            btn.classList.add('active');
            currentIndustryView = btn.dataset.industry;
            renderIndustryEvolutionView(currentIndustryView);
        });
    });

    document.querySelectorAll('#region-switcher .segment-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#region-switcher .segment-btn').forEach(item => item.classList.remove('active'));
            btn.classList.add('active');
            currentRegionView = btn.dataset.province;
            renderRegionPlanningView(currentRegionView);
        });
    });
}

function renderIndustryEvolutionView(industryKey) {
    const data = industryScenarioLibrary[industryKey] || industryScenarioLibrary.manufacturing;
    document.querySelectorAll('#industry-switcher .segment-btn').forEach(item => {
        item.classList.toggle('active', item.dataset.industry === industryKey);
    });
    document.getElementById('industry-risk-level').innerText = data.riskLevel;
    document.getElementById('industry-risk-score').innerText = `风险分值 ${data.riskScore}`;
    document.getElementById('industry-driver-main').innerText = data.mainDriver;
    document.getElementById('industry-driver-desc').innerText = data.driverDesc;
    document.getElementById('industry-policy-focus').innerText = data.policyFocus;
    document.getElementById('industry-policy-desc').innerText = data.policyDesc;
    document.getElementById('industryInsightList').innerHTML = data.insights.map((item, index) => `
        <div class="insight-item">
            <span>${index === 0 ? '核心判断' : (index === 1 ? '风险解释' : '策略结论')}</span>
            <strong>${item}</strong>
        </div>
    `).join('');

    if (!industryEvolutionChart) {
        industryEvolutionChart = echarts.init(document.getElementById('industryEvolutionChart'));
    }
    industryEvolutionChart.setOption({
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(16, 25, 43, 0.9)',
            borderColor: 'rgba(59, 130, 246, 0.5)',
            textStyle: { color: '#E2E8F0' }
        },
        grid: { left: '4%', right: '4%', top: 26, bottom: 24, containLabel: true },
        xAxis: {
            type: 'category',
            data: data.months,
            axisLine: { lineStyle: { color: '#94A3B8' } }
        },
        yAxis: {
            type: 'value',
            min: 40,
            max: 90,
            axisLine: { lineStyle: { color: '#94A3B8' } },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } }
        },
        series: [{
            name: `${data.label}风险指数`,
            type: 'line',
            smooth: true,
            data: data.riskSeries,
            symbolSize: 8,
            lineStyle: { width: 3, color: '#3B82F6' },
            itemStyle: { color: '#10B981' },
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: 'rgba(59, 130, 246, 0.35)' },
                    { offset: 1, color: 'rgba(16, 185, 129, 0.02)' }
                ])
            },
            markLine: {
                silent: true,
                lineStyle: { color: '#F59E0B', type: 'dashed' },
                data: [{ yAxis: data.riskScore, label: { formatter: '当前风险位', color: '#F59E0B' } }]
            }
        }]
    });

    if (!industryDriverHeatmapChart) {
        industryDriverHeatmapChart = echarts.init(document.getElementById('industryDriverHeatmap'));
    }
    industryDriverHeatmapChart.setOption({
        tooltip: {
            position: 'top',
            backgroundColor: 'rgba(16, 25, 43, 0.9)',
            borderColor: 'rgba(59, 130, 246, 0.5)',
            textStyle: { color: '#E2E8F0' },
            formatter: params => `${data.heatmap.stages[params.value[0]]}<br/>${data.heatmap.metrics[params.value[1]]}: ${params.value[2]}`
        },
        grid: { left: '8%', right: '5%', top: 20, bottom: 24, containLabel: true },
        xAxis: {
            type: 'category',
            data: data.heatmap.stages,
            axisLine: { lineStyle: { color: '#94A3B8' } }
        },
        yAxis: {
            type: 'category',
            data: data.heatmap.metrics,
            axisLine: { lineStyle: { color: '#94A3B8' } }
        },
        visualMap: {
            min: 40,
            max: 85,
            orient: 'horizontal',
            left: 'center',
            bottom: 0,
            textStyle: { color: '#94A3B8' },
            inRange: { color: ['#0f172a', '#1d4ed8', '#10B981', '#F59E0B', '#EF4444'] }
        },
        series: [{
            type: 'heatmap',
            data: data.heatmap.values,
            label: { show: true, color: '#E2E8F0', fontSize: 11 }
        }]
    });

    if (!industryNodeRankingChart) {
        industryNodeRankingChart = echarts.init(document.getElementById('industryNodeRanking'));
    }
    industryNodeRankingChart.setOption({
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(16, 25, 43, 0.9)',
            borderColor: 'rgba(59, 130, 246, 0.5)',
            textStyle: { color: '#E2E8F0' }
        },
        grid: { left: '5%', right: '8%', top: 20, bottom: 10, containLabel: true },
        xAxis: {
            type: 'value',
            axisLine: { lineStyle: { color: '#94A3B8' } },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } }
        },
        yAxis: {
            type: 'category',
            data: data.nodeRanking.map(item => item.name).reverse(),
            axisLine: { lineStyle: { color: '#94A3B8' } }
        },
        series: [{
            type: 'bar',
            data: data.nodeRanking.map(item => item.value).reverse(),
            barWidth: 14,
            itemStyle: {
                borderRadius: [0, 6, 6, 0],
                color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
                    { offset: 0, color: '#EF4444' },
                    { offset: 1, color: '#3B82F6' }
                ])
            }
        }]
    });
}

async function renderRegionPlanningView(provinceName) {
    const profile = getProvinceScenario(provinceName);
    currentRegionView = profile.province;
    document.querySelectorAll('#region-switcher .segment-btn').forEach(item => {
        item.classList.toggle('active', item.dataset.province === profile.province);
    });
    document.getElementById('region-credit-env').innerText = profile.credit;
    document.getElementById('region-credit-desc').innerText = profile.creditDesc;
    document.getElementById('region-micro-health').innerText = profile.micro;
    document.getElementById('region-micro-desc').innerText = profile.microDesc;
    document.getElementById('region-policy-pack').innerText = profile.policyPack;
    document.getElementById('region-policy-pack-desc').innerText = profile.policyDesc;
    document.getElementById('regionInsightList').innerHTML = profile.insights.map((item, index) => `
        <div class="insight-item">
            <span>${index === 0 ? '当前结论' : (index === 1 ? '结构解释' : '建议方向')}</span>
            <strong>${item}</strong>
        </div>
    `).join('');

    if (!regionMapPageChart) {
        regionMapPageChart = echarts.init(document.getElementById('regionMapChart'));
    }

    try {
        if (!regionGeoLoaded) {
            const geoResp = await fetch('/js/lib/china.json');
            const chinaJson = await geoResp.json();
            echarts.registerMap('china-stage-five', chinaJson);
            regionGeoLoaded = true;
        }
        const mapPayload = await fetchData('/risk/map', {
            map_data: mockData.mapData,
            scatter_alerts: mockData.mapScatterData.map(d => ({ name: d.name, value: d.value, detail: '区域短期风险脉冲' }))
        });
        regionMapPageChart.setOption({
            tooltip: {
                trigger: 'item',
                backgroundColor: 'rgba(16, 25, 43, 0.9)',
                borderColor: 'rgba(59, 130, 246, 0.5)',
                textStyle: { color: '#E2E8F0' },
                formatter: params => {
                    if (params.seriesType === 'effectScatter') {
                        return `<strong>${params.name}</strong><br/>${params.data.detail || '短期预警点位'}`;
                    }
                    return `<strong>${params.name}</strong><br/>信用环境指数: ${params.value}`;
                }
            },
            visualMap: {
                min: 40,
                max: 100,
                left: 10,
                bottom: 10,
                text: ['优', '弱'],
                calculable: true,
                textStyle: { color: '#94A3B8' },
                inRange: { color: ['#EF4444', '#F59E0B', '#3B82F6', '#10B981'] }
            },
            geo: {
                map: 'china-stage-five',
                roam: false,
                itemStyle: {
                    areaColor: 'rgba(16, 25, 43, 0.82)',
                    borderColor: 'rgba(59, 130, 246, 0.35)',
                    borderWidth: 1
                },
                emphasis: {
                    itemStyle: { areaColor: 'rgba(16, 185, 129, 0.45)' },
                    label: { show: true, color: '#fff' }
                }
            },
            series: [
                {
                    type: 'map',
                    map: 'china-stage-five',
                    roam: false,
                    data: mapPayload.map_data
                },
                {
                    type: 'effectScatter',
                    coordinateSystem: 'geo',
                    data: mapPayload.scatter_alerts,
                    symbolSize: 14,
                    rippleEffect: { scale: 3.5 },
                    itemStyle: { color: '#EF4444', shadowBlur: 10, shadowColor: '#EF4444' }
                }
            ]
        });
        regionMapPageChart.off('click');
        regionMapPageChart.on('click', params => {
            if (!params.name) return;
            const cleanName = String(params.name)
                .replace(/\s*[（(].*?[)）]/g, '')
                .replace(/(省|市|自治区|维吾尔自治区|壮族自治区|回族自治区)$/, '')
                .trim();
            if (!cleanName) return;
            document.querySelectorAll('#region-switcher .segment-btn').forEach(item => {
                item.classList.toggle('active', item.dataset.province === cleanName);
            });
            renderRegionPlanningView(cleanName);
            openProvinceSidebar(cleanName);
        });
    } catch (e) {
        document.getElementById('regionMapChart').innerHTML = '<div style="color:white; padding: 20px;">区域地图加载失败，请检查本地 GeoJSON。</div>';
    }

    if (!regionStructureChart) {
        regionStructureChart = echarts.init(document.getElementById('regionStructureChart'));
    }
    regionStructureChart.setOption({
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(16,25,43,0.9)',
            textStyle: { color: '#E2E8F0' }
        },
        color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
        series: [{
            type: 'pie',
            left: '8%',
            right: '8%',
            top: 16,
            bottom: 16,
            center: ['50%', '58%'],
            radius: ['40%', '66%'],
            avoidLabelOverlap: true,
            minShowLabelAngle: 3,
            label: {
                show: true,
                position: 'outside',
                color: '#E2E8F0',
                fontSize: 11,
                formatter: '{b}',
                width: 72,
                overflow: 'break'
            },
            labelLine: {
                show: true,
                length: 12,
                length2: 10,
                lineStyle: { width: 1.5 }
            },
            data: profile.industryDistribution
        }]
    }, true);

    if (!regionRiskFactorChart) {
        regionRiskFactorChart = echarts.init(document.getElementById('regionRiskFactorChart'));
    }
    regionRiskFactorChart.setOption({
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(16,25,43,0.9)',
            textStyle: { color: '#E2E8F0' }
        },
        grid: { left: '5%', right: '8%', top: 20, bottom: 10, containLabel: true },
        xAxis: {
            type: 'value',
            axisLine: { lineStyle: { color: '#94A3B8' } },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } }
        },
        yAxis: {
            type: 'category',
            data: profile.riskFactors.map(item => item.name).reverse(),
            axisLine: { lineStyle: { color: '#94A3B8' } }
        },
        series: [{
            type: 'bar',
            data: profile.riskFactors.map(item => item.value).reverse(),
            barWidth: 14,
            itemStyle: {
                borderRadius: [0, 6, 6, 0],
                color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
                    { offset: 0, color: '#F59E0B' },
                    { offset: 1, color: '#3B82F6' }
                ])
            }
        }]
    }, true);
}

async function initMapChart() {
    mapChart = echarts.init(document.getElementById('mapChart'));
    
    try {
        const geoResp = await fetch('/js/lib/china.json');
        const chinaJson = await geoResp.json();
        echarts.registerMap('china', chinaJson);
        
        // 从 API 获取地图数据 (或回退)
        const mapPayload = await fetchData('/risk/map', {
            map_data: mockData.mapData,
            scatter_alerts: mockData.mapScatterData.map(d => ({ name: d.name, value: d.value }))
        });

        const mapOption = {
            tooltip: {
                trigger: 'item',
                confine: true,
                enterable: false,
                backgroundColor: 'rgba(16, 25, 43, 0.9)',
                borderColor: 'rgba(59, 130, 246, 0.5)',
                textStyle: { color: '#E2E8F0' },
                extraCssText: 'max-width: 280px; white-space: normal; line-height: 1.6; box-shadow: 0 12px 28px rgba(0,0,0,0.28);',
                position(pos, params, dom, rect, size) {
                    const [x, y] = pos;
                    const viewWidth = size.viewSize[0];
                    const viewHeight = size.viewSize[1];
                    const boxWidth = dom.offsetWidth || 260;
                    const boxHeight = dom.offsetHeight || 120;
                    const nextX = Math.min(Math.max(12, x + 16), Math.max(12, viewWidth - boxWidth - 12));
                    const nextY = Math.min(Math.max(12, y - boxHeight - 16), Math.max(12, viewHeight - boxHeight - 12));
                    return [nextX, nextY];
                },
                formatter: function(params) {
                    if (params.seriesType === 'effectScatter') {
                        const d = params.data;
                        return `<strong>${d.name}</strong><br/>${d.detail || '短期风险脉冲预警'}`;
                    }
                    return `<strong>${params.name}</strong><br/>普惠信用环境指数: <span style="color:#10B981">${params.value}</span>`;
                }
            },
            visualMap: {
                min: 40, max: 100,
                text: ['高信用', '高风险'],
                realtime: false, calculable: true,
                inRange: { color: ['#EF4444', '#F59E0B', '#3B82F6', '#10B981'] },
                textStyle: { color: '#94A3B8' }
            },
            geo: {
                map: 'china', roam: false,
                label: { show: false },
                itemStyle: {
                    areaColor: 'rgba(16, 25, 43, 0.8)',
                    borderColor: 'rgba(59, 130, 246, 0.4)',
                    borderWidth: 1
                },
                emphasis: {
                    label: { show: true, color: '#fff' },
                    itemStyle: { areaColor: 'rgba(59, 130, 246, 0.6)' }
                }
            },
            series: [
                {
                    name: '区域信用趋势',
                    type: 'map',
                    map: 'china',
                    roam: false,
                    label: { show: false, color: 'rgba(255,255,255,0.7)' },
                    itemStyle: {
                        areaColor: 'rgba(16, 25, 43, 0.8)',
                        borderColor: 'rgba(59, 130, 246, 0.4)',
                        borderWidth: 1
                    },
                    emphasis: {
                        label: { show: true, color: '#fff' },
                        itemStyle: { areaColor: 'rgba(59, 130, 246, 0.8)' }
                    },
                    data: mapPayload.map_data
                },
                {
                    name: '短期风险脉冲预警',
                    type: 'effectScatter',
                    coordinateSystem: 'geo',
                    data: mapPayload.scatter_alerts,
                    symbolSize: 15,
                    showEffectOn: 'render',
                    rippleEffect: { brushType: 'stroke', scale: 4 },
                    itemStyle: {
                        color: '#EF4444',
                        shadowBlur: 10,
                        shadowColor: '#EF4444'
                    },
                    label: {
                        formatter: '{b}', position: 'right', show: true,
                        color: '#fff',
                        textShadowColor: 'rgba(0,0,0,0.8)',
                        textShadowBlur: 5
                    }
                }
            ]
        };
        mapChart.setOption(mapOption);
        mapChart.off('click');
        mapChart.on('click', 'series', (params) => {
            if (!params.name) return;
            const raw = params.name;
            const cleanName = raw
                .replace(/\s*[（(].*?[)）]/g, '')
                .replace(/(省|市|自治区|维吾尔自治区|壮族自治区|回族自治区)$/, '')
                .trim();
            if (cleanName) openProvinceSidebar(cleanName);
        });
    } catch (e) {
        console.error('Map load failed', e);
        document.getElementById('mapChart').innerHTML = '<div style="color:white; padding: 20px;">地图加载失败，请检查本地资源文件是否完整。</div>';
    }
}

async function initTrendChart() {
    // ---------- 2. 趋势折线图 (含置信区间) ----------
    trendChart = echarts.init(document.getElementById('trendChart'));
    
    const trendPayload = await fetchData('/trends', {
        months: mockData.trendMonthsExtended,
        actual: mockData.trendNPL,
        prediction: mockData.trendPrediction,
        confidence_upper: null,
        confidence_lower: null
    });

    const trendSeries = [
        {
            name: '实际不良率 (%)',
            type: 'line',
            data: trendPayload.actual,
            smooth: true,
            itemStyle: { color: '#EF4444' },
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: 'rgba(239, 68, 68, 0.4)' },
                    { offset: 1, color: 'rgba(239, 68, 68, 0)' }
                ])
            }
        },
        {
            name: 'LSTM 预测不良率 (%)',
            type: 'line',
            data: trendPayload.prediction,
            smooth: true,
            lineStyle: { type: 'dashed', width: 2 },
            itemStyle: { color: '#F59E0B' }
        }
    ];

    // 添加置信区间 (如果后端返回了)
    if (trendPayload.confidence_upper && trendPayload.confidence_lower) {
        trendSeries.push({
            name: '95% 置信区间上界',
            type: 'line',
            data: trendPayload.confidence_upper,
            smooth: true,
            lineStyle: { opacity: 0 },
            itemStyle: { color: 'transparent' },
            areaStyle: {
                color: 'rgba(245, 158, 11, 0.15)'
            },
            stack: 'confidence',
            symbol: 'none'
        });
        trendSeries.push({
            name: '95% 置信区间下界',
            type: 'line',
            data: trendPayload.confidence_lower,
            smooth: true,
            lineStyle: { opacity: 0 },
            itemStyle: { color: 'transparent' },
            areaStyle: {
                color: 'rgba(245, 158, 11, 0.15)'
            },
            stack: 'confidence',
            symbol: 'none'
        });
    }

    trendChart.setOption({
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(16, 25, 43, 0.9)',
            borderColor: 'rgba(59, 130, 246, 0.5)',
            textStyle: { color: '#E2E8F0' }
        },
        legend: {
            data: ['实际不良率 (%)', 'LSTM 预测不良率 (%)'],
            textStyle: { color: '#E2E8F0' },
            top: 0
        },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: trendPayload.months,
            axisLine: { lineStyle: { color: '#94A3B8' } }
        },
        yAxis: {
            type: 'value', min: 1.5, max: 3.0,
            axisLine: { lineStyle: { color: '#94A3B8' } },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
        },
        series: trendSeries
    });
}

async function initRelationChart() {
    // ---------- 3. 产业链关系图 ----------
    relationChart = echarts.init(document.getElementById('relationChart'));
    
    const graphPayload = await fetchData('/industry/graph', buildLocalIndustryGraph());
    setIndustryLinkPanel(null, graphPayload);

    relationChart.setOption({
        tooltip: {
            backgroundColor: 'rgba(16, 25, 43, 0.9)',
            borderColor: 'rgba(59, 130, 246, 0.5)',
            textStyle: { color: '#E2E8F0' },
            formatter: (params) => {
                if (params.dataType === 'node') {
                    const node = params.data;
                    return [
                        `<strong>${node.name}</strong>`,
                        `风险等级: ${node.risk_level || '--'} / ${node.risk_score || '--'}`,
                        node.description || '',
                        `<span style="color:#10B981">政策焦点: ${node.policy_focus || '待补充'}</span>`
                    ].filter(Boolean).join('<br/>');
                }
                if (params.dataType === 'edge') {
                    const edge = params.data;
                    return [
                        `<strong>${edge.risk_type || '传导关系'}</strong>`,
                        `传导强度: ${edge.value ?? '--'}`,
                        edge.explanation || ''
                    ].filter(Boolean).join('<br/>');
                }
                return '';
            }
        },
        legend: [{
            data: graphPayload.categories.map(a => a.name),
            textStyle: { color: '#E2E8F0', fontSize: 10 },
            bottom: 0
        }],
        color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'],
        series: [{
            name: '产业链图谱',
            type: 'graph',
            layout: 'force',
            data: graphPayload.nodes,
            links: graphPayload.links,
            categories: graphPayload.categories,
            roam: true,
            label: {
                show: true, position: 'right',
                formatter: '{b}', color: '#E2E8F0'
            },
            force: { repulsion: 250, edgeLength: [60, 120] },
            lineStyle: { color: 'source', curveness: 0.3 }
        }]
    });

    relationChart.off('click');
    relationChart.on('click', params => {
        if (params.dataType !== 'node') return;
        applyIndustryNodePreset(params.data, graphPayload);
    });
}

// Window Resize 适配
window.addEventListener('resize', () => {
    if (mapChart) mapChart.resize();
    if (trendChart) trendChart.resize();
    if (relationChart) relationChart.resize();
    if (radarChart) radarChart.resize();
    if (industryEvolutionChart) industryEvolutionChart.resize();
    if (industryDriverHeatmapChart) industryDriverHeatmapChart.resize();
    if (industryNodeRankingChart) industryNodeRankingChart.resize();
    if (regionMapPageChart) regionMapPageChart.resize();
    if (regionStructureChart) regionStructureChart.resize();
    if (regionRiskFactorChart) regionRiskFactorChart.resize();
    if (compareChart) compareChart.resize();
    if (compareTrendChart) compareTrendChart.resize();
    if (pieChart) pieChart.resize();
    if (barChart) barChart.resize();
});

document.addEventListener('DOMContentLoaded', initCharts);

// ============================================================
// 政策模拟器交互
// ============================================================
const simGuarantee = document.getElementById('sim-guarantee');
const simRate = document.getElementById('sim-rate');
const simSubsidy = document.getElementById('sim-subsidy');
const valGuarantee = document.getElementById('val-guarantee');
const valRate = document.getElementById('val-rate');
const valSubsidy = document.getElementById('val-subsidy');

simGuarantee.addEventListener('input', (e) => valGuarantee.innerText = e.target.value + '%');
simRate.addEventListener('input', (e) => valRate.innerText = parseFloat(e.target.value).toFixed(2) + '%');
simSubsidy.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    valSubsidy.innerText = val === 1 ? '低' : (val === 2 ? '中' : '高');
});
updateSimulatorBadges();

initRawDataSelectors();

document.getElementById('btn-scene-search')?.addEventListener('click', () => {
    runRawDataSearch();
});

document.getElementById('scene-search-year')?.addEventListener('change', () => {
    syncSceneSearchSelectState(document.getElementById('scene-search-year'));
    runRawDataSearch();
});

document.getElementById('scene-search-province')?.addEventListener('change', () => {
    syncSceneSearchSelectState(document.getElementById('scene-search-province'));
    const provinceValue = document.getElementById('scene-search-province')?.value || '';
    const cityEl = document.getElementById('scene-search-city');
    if (!cityEl) return;
    if (provinceValue && provinceValue !== '广东') {
        fillSelectOptions(cityEl, [], '全部城市');
    }
    syncSceneSearchSelectState(cityEl);
    runRawDataSearch();
});

document.getElementById('scene-search-city')?.addEventListener('change', () => {
    syncSceneSearchSelectState(document.getElementById('scene-search-city'));
    runRawDataSearch();
});

document.getElementById('scene-search-industry')?.addEventListener('change', () => {
    syncSceneSearchSelectState(document.getElementById('scene-search-industry'));
    runRawDataSearch();
});

// 运行模拟推演
document.getElementById('btn-simulate').addEventListener('click', async () => {
    const params = {
        guarantee_rate: parseInt(simGuarantee.value),
        interest_offset: parseFloat(simRate.value),
        subsidy_level: parseInt(simSubsidy.value)
    };

    // 显示 AI 推演遮罩
    const modal = document.getElementById('ai-modal');
    const aiStatus = document.getElementById('ai-status');
    modal.classList.add('active');
    
    // 模拟推演步骤文案
    const steps = [
        "正在调用双重差分 (DID) 与 CGE 预测模型...",
        "计算政策传导路径与因果链...",
        "生成蒙特卡洛敏感性分析...",
        "输出结构化决策报告..."
    ];
    let stepIdx = 0;
    const stepTimer = setInterval(() => {
        stepIdx++;
        if (stepIdx < steps.length) {
            aiStatus.innerText = steps[stepIdx];
        }
    }, 600);

    // 调用后端 API (POST JSON Body)
    let result;
    try {
        const resp = await fetch(API_BASE + '/policy/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        if (!resp.ok) throw new Error('API Error');
        result = await resp.json();
    } catch (e) {
        console.warn("[Simulation] 后端接口获取失败，切换至本地启发式计算", e);
        result = buildLocalPolicyResult(
            params.guarantee_rate,
            params.interest_offset,
            params.subsidy_level
        );
    }
    reportState.latestPolicyResult = result;

    clearInterval(stepTimer);

    // 延迟关闭 modal 以增加仪式感
    setTimeout(() => {
        modal.classList.remove('active');

        // 渲染结果面板
        const resultsDiv = document.getElementById('sim-results');
        const warnings = (result.risk_warnings || []).filter(Boolean);
        const warningsHTML = warnings.map(w =>
            `<div class="sim-msg warning"><i class="fa-solid fa-triangle-exclamation"></i> ${w}</div>`
        ).join('');
        const industryContextHTML = reportState.industrySelection ? `
            <div class="sim-msg"><i class="fa-solid fa-diagram-project"></i> 定向节点: <strong>${reportState.industrySelection.node_name}</strong> | ${reportState.industrySelection.risk_level}风险 · ${reportState.industrySelection.risk_score}</div>
            <div class="sim-msg"><i class="fa-solid fa-crosshairs"></i> 节点焦点: <strong>${reportState.industrySelection.policy_focus}</strong></div>
        ` : '';

        resultsDiv.innerHTML = `
            <div class="sim-msg highlight"><i class="fa-solid fa-check-circle"></i> 推演完成 | DID 估计量: ${result.did_estimate}</div>
            ${industryContextHTML}
            <div class="sim-msg"><i class="fa-solid fa-tag"></i> 方案类型: <strong>${result.policy_bucket || ''}</strong> | ${result.scenario_summary || ''}</div>
            <div class="sim-msg">预测不良率: <strong>${result.current_npl}%</strong> → <strong style="color:var(--accent-green)">${result.predicted_npl}%</strong></div>
            <div class="sim-msg">受益小微企业数: <strong>${result.benefit_enterprise_count.toLocaleString()}</strong> 家</div>
            <div class="sim-msg">财政成本: <strong>${result.fiscal_cost_billion}</strong> 亿 | 政策 ROI: <strong>${result.roi}</strong>${result.roi_unit ? ` (${result.roi_unit})` : ''}</div>
            <div class="sim-section">
                <div class="sim-section-title">政策工具组合</div>
                <div class="policy-chip-group">${renderPolicyTools(result.policy_tools)}</div>
            </div>
            <div class="sim-section two-col">
                <div>
                    <div class="sim-section-title">作用路径</div>
                    <ul class="detail-list">${renderPathList(result.transmission_paths)}</ul>
                </div>
                <div>
                    <div class="sim-section-title">适用对象</div>
                    <ul class="detail-list compact">${renderBulletList(result.target_segments, 'fa-location-dot')}</ul>
                </div>
            </div>
            <div class="sim-section">
                <div class="sim-section-title">执行约束</div>
                <ul class="detail-list compact">${renderBulletList(result.implementation_conditions || [], 'fa-circle-exclamation')}</ul>
            </div>
            <div class="sim-section">
                <div class="sim-section-title">决策证据</div>
                <ul class="detail-list compact">${renderBulletList(result.evidence_points || [], 'fa-check')}</ul>
            </div>
            ${renderScorecard(result.scorecard)}
            ${warningsHTML}
            <div class="sim-msg" style="margin-top:8px; color:var(--accent-blue)"><i class="fa-solid fa-lightbulb"></i> ${result.policy_recommendation || ''}</div>
        `;

        // 更新趋势图
        let dynamicPrediction = new Array(10).fill(null).concat(
            result.prediction_values ? [result.prediction_values[0], result.prediction_values[0]] : [2.15, 2.14]
        );
        if (result.prediction_values) {
            dynamicPrediction = dynamicPrediction.concat(result.prediction_values);
        }

        trendChart.setOption({
            series: [{
                name: 'LSTM 预测不良率 (%)',
                data: dynamicPrediction
            }]
        });
    }, 500);
});

// ============================================================
// Province Drill-Down Sidebar
// ============================================================
let pieChart, barChart;

function openProvinceSidebar(provinceName) {
    const sidebar = document.getElementById('province-sidebar');
    document.getElementById('province-name').innerText = provinceName;
    sidebar.classList.add('open');

    // Fetch province detail from API (or compute fallback)
    fetchData(`/province/${encodeURIComponent(provinceName)}`, null).then(data => {
        if (!data) {
            const profile = getProvinceScenario(provinceName);
            data = {
                province: provinceName,
                npl: profile.npl.toFixed(2),
                credit_index: profile.credit,
                micro_health: profile.micro,
                alert: null,
                industry_distribution: profile.industryDistribution,
                risk_factors: profile.riskFactors
            };
        }

        // Update stats
        document.getElementById('p-npl').innerText = data.npl + '%';
        document.getElementById('p-credit').innerText = data.credit_index;
        document.getElementById('p-micro').innerText = data.micro_health;

        // Alert
        const warningDiv = document.getElementById('province-warning');
        if (data.alert) {
            warningDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${data.alert}`;
        } else {
            warningDiv.innerHTML = '<i class="fa-solid fa-circle-check" style="color:var(--accent-green)"></i> 当前区域风险指标平稳，暂无预警触发。';
        }

        // Industry Pie Chart
        if (pieChart) pieChart.dispose();
        pieChart = echarts.init(document.getElementById('industryPieChart'));
        pieChart.setOption({
            tooltip: { trigger: 'item', backgroundColor: 'rgba(16,25,43,0.9)', textStyle: {color: '#E2E8F0'} },
            color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
            series: [{
                type: 'pie',
                left: '8%',
                right: '8%',
                top: 10,
                bottom: 10,
                center: ['50%', '56%'],
                radius: ['38%', '64%'],
                avoidLabelOverlap: true,
                minShowLabelAngle: 3,
                label: {
                    show: true,
                    position: 'outside',
                    color: '#E2E8F0',
                    fontSize: 11,
                    formatter: '{b}',
                    width: 72,
                    overflow: 'break'
                },
                labelLine: {
                    show: true,
                    length: 10,
                    length2: 8,
                    lineStyle: { width: 1.5 }
                },
                data: data.industry_distribution
            }]
        });

        // Risk Factor Bar Chart
        if (barChart) barChart.dispose();
        barChart = echarts.init(document.getElementById('riskBarChart'));
        barChart.setOption({
            tooltip: { trigger: 'axis', backgroundColor: 'rgba(16,25,43,0.9)', textStyle: {color: '#E2E8F0'} },
            grid: { left: '3%', right: '10%', top: '5%', bottom: '3%', containLabel: true },
            xAxis: { type: 'value', axisLine: {lineStyle:{color:'#94A3B8'}}, splitLine: {lineStyle:{color:'rgba(255,255,255,0.05)'}} },
            yAxis: {
                type: 'category', axisLine: {lineStyle:{color:'#94A3B8'}},
                data: data.risk_factors.map(d => d.name)
            },
            series: [{
                type: 'bar', barWidth: 14,
                data: data.risk_factors.map(d => d.value),
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                        {offset: 0, color: 'rgba(239,68,68,0.8)'},
                        {offset: 1, color: 'rgba(245,158,11,0.8)'}
                    ]),
                    borderRadius: [0, 4, 4, 0]
                }
            }]
        });
    });
}

// Close sidebar
document.getElementById('close-province').addEventListener('click', () => {
    document.getElementById('province-sidebar').classList.remove('open');
});

// ============================================================
// Policy Comparison Page (Scenario A vs B)
// ============================================================
let compareChart, compareTrendChart;

// Wire up scenario slider labels
function wireScenarioSliders(prefix) {
    const g = document.getElementById(`${prefix}-guarantee`);
    const r = document.getElementById(`${prefix}-rate`);
    const s = document.getElementById(`${prefix}-subsidy`);
    if (!g || !r || !s) return;

    g.addEventListener('input', e => document.getElementById(`${prefix}-val-g`).innerText = e.target.value + '%');
    r.addEventListener('input', e => document.getElementById(`${prefix}-val-r`).innerText = parseFloat(e.target.value).toFixed(2) + '%');
    s.addEventListener('input', e => {
        const v = parseInt(e.target.value);
        document.getElementById(`${prefix}-val-s`).innerText = v === 1 ? '低' : (v === 2 ? '中' : '高');
    });
}
wireScenarioSliders('a');
wireScenarioSliders('b');

async function runScenario(prefix) {
    const g = parseInt(document.getElementById(`${prefix}-guarantee`).value);
    const r = parseFloat(document.getElementById(`${prefix}-rate`).value);
    const s = parseInt(document.getElementById(`${prefix}-subsidy`).value);

    let result;
    try {
        const resp = await fetch(`${API_BASE}/policy/simulate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                guarantee_rate: g,
                interest_offset: r,
                subsidy_level: s
            })
        });
        if (!resp.ok) throw new Error('API error');
        result = await resp.json();
    } catch (e) {
        result = buildLocalPolicyResult(g, r, s);
    }

    // Update result panel
    document.getElementById(`${prefix}-npl`).innerText = result.predicted_npl + '%';
    document.getElementById(`${prefix}-did`).innerText = result.did_estimate;
    document.getElementById(`${prefix}-biz`).innerText = result.benefit_enterprise_count.toLocaleString();
    document.getElementById(`${prefix}-cost`).innerText = result.fiscal_cost_billion + ' 亿';
    document.getElementById(`${prefix}-roi`).innerText = `${result.roi} · ${result.policy_bucket || ''}`;
    const container = document.getElementById(`${prefix}-result`);
    if (container) {
        container.innerHTML = `
            <div class="result-row"><span>方案摘要</span><strong>${result.scenario_summary}</strong></div>
            <div class="result-row"><span>预测不良率</span><strong class="text-glow-red">${result.predicted_npl}%</strong></div>
            <div class="result-row"><span>DID 估计量</span><strong>${result.did_estimate}</strong></div>
            <div class="result-row"><span>受益企业数</span><strong>${result.benefit_enterprise_count.toLocaleString()}</strong></div>
            <div class="result-row"><span>财政成本</span><strong>${result.fiscal_cost_billion} 亿</strong></div>
            <div class="result-row"><span>政策 ROI</span><strong class="text-glow-green">${result.roi}</strong></div>
            <div class="result-row"><span>工具组合</span><strong>${(result.policy_tools || []).map(item => item.name).join(' / ')}</strong></div>
            <div class="result-row"><span>综合评分</span><strong>${result.scorecard?.composite_score ?? '--'}</strong></div>
        `;
    }

    return result;
}

// Run comparison
document.getElementById('btn-compare')?.addEventListener('click', async () => {
    // Show AI modal
    const modal = document.getElementById('ai-modal');
    const aiStatus = document.getElementById('ai-status');
    modal.classList.add('active');
    aiStatus.innerText = '同时运行情景 A & B 双因果推断模型...';

    const [resultA, resultB] = await Promise.all([runScenario('a'), runScenario('b')]);

    setTimeout(() => {
        aiStatus.innerText = '生成对比分析报告...';
    }, 500);

    setTimeout(() => {
        modal.classList.remove('active');

        // Initialize comparison bar chart
        if (!compareChart) {
            compareChart = echarts.init(document.getElementById('compareChart'));
        }
        compareChart.setOption({
            tooltip: {
                trigger: 'axis', axisPointer: { type: 'shadow' },
                backgroundColor: 'rgba(16,25,43,0.9)', textStyle: {color:'#E2E8F0'}
            },
            legend: { data: ['情景 A', '情景 B'], textStyle: {color:'#E2E8F0'}, top: 0 },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: {
                type: 'category',
                data: ['预测不良率(%)', 'DID 估计量', '受益企业(万)', '财政成本(亿)'],
                axisLine: {lineStyle:{color:'#94A3B8'}},
                axisLabel: { color: '#94A3B8', fontSize: 11 }
            },
            yAxis: {
                type: 'value',
                axisLine: {lineStyle:{color:'#94A3B8'}},
                splitLine: {lineStyle:{color:'rgba(255,255,255,0.08)'}}
            },
            series: [
                {
                    name: '情景 A', type: 'bar', barGap: '20%',
                    data: [
                        resultA.predicted_npl,
                        resultA.did_estimate,
                        (resultA.benefit_enterprise_count / 10000).toFixed(1),
                        resultA.fiscal_cost_billion
                    ],
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            {offset: 0, color: 'rgba(59,130,246,0.9)'},
                            {offset: 1, color: 'rgba(59,130,246,0.3)'}
                        ]),
                        borderRadius: [4, 4, 0, 0]
                    }
                },
                {
                    name: '情景 B', type: 'bar',
                    data: [
                        resultB.predicted_npl,
                        resultB.did_estimate,
                        (resultB.benefit_enterprise_count / 10000).toFixed(1),
                        resultB.fiscal_cost_billion
                    ],
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            {offset: 0, color: 'rgba(16,185,129,0.9)'},
                            {offset: 1, color: 'rgba(16,185,129,0.3)'}
                        ]),
                        borderRadius: [4, 4, 0, 0]
                    }
                }
            ]
        });

        // Comparison trend chart
        if (!compareTrendChart) {
            compareTrendChart = echarts.init(document.getElementById('compareTrendChart'));
        }
        const baseMonths = ['当前', '25-01', '25-02', '25-03'];
        compareTrendChart.setOption({
            tooltip: { trigger: 'axis', backgroundColor: 'rgba(16,25,43,0.9)', textStyle: {color:'#E2E8F0'} },
            legend: { data: ['情景 A 不良率', '情景 B 不良率'], textStyle: {color:'#E2E8F0'}, top: 0 },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: { type: 'category', data: baseMonths, axisLine: {lineStyle:{color:'#94A3B8'}} },
            yAxis: {
                type: 'value', min: 0.5, max: 2.5,
                axisLine: {lineStyle:{color:'#94A3B8'}},
                splitLine: {lineStyle:{color:'rgba(255,255,255,0.08)'}}
            },
            series: [
                {
                    name: '情景 A 不良率', type: 'line', smooth: true,
                    data: [2.14, ...(resultA.prediction_values || [])],
                    itemStyle: { color: '#3B82F6' },
                    areaStyle: { color: 'rgba(59,130,246,0.15)' }
                },
                {
                    name: '情景 B 不良率', type: 'line', smooth: true,
                    data: [2.14, ...(resultB.prediction_values || [])],
                    itemStyle: { color: '#10B981' },
                    areaStyle: { color: 'rgba(16,185,129,0.15)' }
                }
            ]
        });

        // Policy recommendation
        const recommendDiv = document.getElementById('policy-recommend');
        const recommendText = document.getElementById('recommend-text');
        recommendDiv.style.display = 'flex';

        const scoreA = calculateRecommendationScore(resultA);
        const scoreB = calculateRecommendationScore(resultB);
        const betterScenario = scoreB > scoreA ? 'B' : 'A';
        const winner = betterScenario === 'A' ? resultA : resultB;
        const loser = betterScenario === 'A' ? resultB : resultA;
        const winnerScore = betterScenario === 'A' ? scoreA : scoreB;
        const loserScore = betterScenario === 'A' ? scoreB : scoreA;
        reportState.comparison = {
            betterScenario: `情景 ${betterScenario}`,
            resultA,
            resultB,
            summary: `基于“效率 + 覆盖面”综合评分，推荐情景 ${betterScenario}，得分 ${winnerScore.toFixed(2)}，对比方案得分 ${loserScore.toFixed(2)}。`
        };
        reportState.latestPolicyResult = winner;

        recommendText.innerHTML = `<strong>推荐采用情景 ${betterScenario}</strong>：基于“效率 + 覆盖面”综合评分，当前方案得分 <strong style="color:var(--accent-green)">${winnerScore.toFixed(2)}</strong>，对比方案为 ${loserScore.toFixed(2)}。该方案属于 <strong>${winner.policy_bucket || '候选方案'}</strong>，预计不良率降至 <strong style="color:var(--accent-green)">${winner.predicted_npl}%</strong>，受益 <strong>${winner.benefit_enterprise_count.toLocaleString()}</strong> 家小微企业，单位 ROI 为 <strong>${winner.roi}</strong>${winner.roi_unit ? `（${winner.roi_unit}）` : ''}。`;

        // Resize
        compareChart.resize();
        compareTrendChart.resize();
    }, 1500);
});
