// Mock data for the Inclusive Finance Dashboard

const mockData = {
    // Map Data: China Provinces Risk/Credit Index (Simulated)
    mapData: [
        { name: '北京', value: 85 },
        { name: '天津', value: 78 },
        { name: '上海', value: 92 },
        { name: '重庆', value: 75 },
        { name: '河北', value: 65 },
        { name: '河南', value: 68 },
        { name: '云南', value: 55 },
        { name: '辽宁', value: 60 },
        { name: '黑龙江', value: 58 },
        { name: '湖南', value: 72 },
        { name: '安徽', value: 73 },
        { name: '山东', value: 80 },
        { name: '新疆', value: 50 },
        { name: '江苏', value: 88 },
        { name: '浙江', value: 90 },
        { name: '江西', value: 70 },
        { name: '湖北', value: 74 },
        { name: '广西', value: 62 },
        { name: '甘肃', value: 52 },
        { name: '山西', value: 61 },
        { name: '内蒙古', value: 59 },
        { name: '陕西', value: 66 },
        { name: '吉林', value: 57 },
        { name: '福建', value: 82 },
        { name: '贵州', value: 56 },
        { name: '广东', value: 95 }, // Highlighted per document
        { name: '青海', value: 48 },
        { name: '西藏', value: 45 },
        { name: '四川', value: 77 },
        { name: '宁夏', value: 54 },
        { name: '海南', value: 69 },
        { name: '台湾', value: 86 },
        { name: '香港', value: 94 },
        { name: '澳门', value: 91 }
    ],

    // Map Scatter Data: Highlighted High-Risk Zones with Coordinates
    mapScatterData: [
        { name: '广东 (高危供应链异动)', value: [113.280637, 23.125178, 100] }, // Longitude, Latitude, Value
        { name: '上海 (跨区流动性收紧)', value: [121.472644, 31.231706, 80] },
        { name: '北京 (政策调控压力)', value: [116.405285, 39.904989, 70] }
    ],

    // Warning Ticker Messages for Rotation
    tickerMessages: [
        "模拟预警: 广东省某制造业协会出现产业链违约异动信号，风险指数升级至 [黄色警告]...",
        "实时监控: 上海地区由于跨区域流动性收紧，中小微企业融资成本平均上升 0.15%...",
        "AI 风险推演: 预计下季度传统零售业景气度下降，建议调整不良率容忍度拨备...",
        "系统提示: 国家发改委最新降准政策已并入沙盘，可前往右侧 [动态政策模拟沙盘] 进行推演验证"
    ],

    // Trend Chart Data: Monthly NPL ratios

    trendMonths: ['24-01', '24-02', '24-03', '24-04', '24-05', '24-06', '24-07', '24-08', '24-09', '24-10', '24-11', '24-12'],
    trendNPL: [2.5, 2.45, 2.4, 2.38, 2.35, 2.3, 2.25, 2.28, 2.2, 2.18, 2.15, 2.14],
    trendPrediction: [null, null, null, null, null, null, null, null, null, null, 2.15, 2.14, 2.12, 2.05, 1.95], // Extending to future
    trendMonthsExtended: ['24-01', '24-02', '24-03', '24-04', '24-05', '24-06', '24-07', '24-08', '24-09', '24-10', '24-11', '24-12', '25-01', '25-02', '25-03'],

    // Relation Graph Data: Industry chain risk contagion
    relationNodes: [
        { id: '0', name: '区域政策银行', symbolSize: 40, category: 0 },
        { id: '1', name: '核心制造企业A', symbolSize: 30, category: 1 },
        { id: '2', name: '上游供应商B', symbolSize: 20, category: 2 },
        { id: '3', name: '上游供应商C', symbolSize: 20, category: 2 },
        { id: '4', name: '下游经销商D', symbolSize: 25, category: 3 },
        { id: '5', name: '地方担保机构', symbolSize: 35, category: 0 },
        { id: '6', name: '原材料供应商E', symbolSize: 15, category: 2 }
    ],
    relationLinks: [
        { source: '0', target: '1', edgeSymbol: ['circle', 'arrow'] },
        { source: '5', target: '1' },
        { source: '1', target: '2' },
        { source: '1', target: '3' },
        { source: '1', target: '4', edgeSymbol: ['circle', 'arrow'] },
        { source: '2', target: '6' },
        { source: '0', target: '5' }
    ],
    relationCategories: [
        { name: '金融机构' },
        { name: '核心企业' },
        { name: '上游产业' },
        { name: '下游产业' }
    ]
};
