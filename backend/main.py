from fastapi import FastAPI, Query, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
from pathlib import Path
import data_provider as dp
import schemas

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

app = FastAPI(
    title="普惠金融风险动态评估平台 API",
    version="1.0.0",
    description="区域与行业大数据驱动的普惠金融风险动态评估系统"
)

# CORS: 允许前端跨域请求 (开发阶段)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# CSS/JS 将通过显式路由提供，不使用 StaticFiles mount


# ============================================================
# API Routes
# ============================================================

@app.get("/")
async def serve_frontend():
    """Serve the main frontend index.html"""
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

@app.get("/css/{filename}")
async def serve_css(filename: str):
    safe = (Path(FRONTEND_DIR) / "css" / filename).resolve()
    if not str(safe).startswith(str(Path(FRONTEND_DIR, "css").resolve())):
        raise HTTPException(status_code=403, detail="Forbidden")
    return FileResponse(safe)

@app.get("/js/lib/{filename}")
async def serve_lib(filename: str):
    safe = (Path(FRONTEND_DIR) / "js" / "lib" / filename).resolve()
    if not str(safe).startswith(str(Path(FRONTEND_DIR, "js", "lib").resolve())):
        raise HTTPException(status_code=403, detail="Forbidden")
    return FileResponse(safe)

@app.get("/js/{filename}")
async def serve_js(filename: str):
    safe = (Path(FRONTEND_DIR) / "js" / filename).resolve()
    if not str(safe).startswith(str(Path(FRONTEND_DIR, "js").resolve())):
        raise HTTPException(status_code=403, detail="Forbidden")
    return FileResponse(safe)

@app.get("/assets/{filename}")
async def serve_assets(filename: str):
    safe = (Path(FRONTEND_DIR) / "assets" / filename).resolve()
    if not str(safe).startswith(str(Path(FRONTEND_DIR, "assets").resolve())):
        raise HTTPException(status_code=403, detail="Forbidden")
    return FileResponse(safe)


@app.get("/api/v1/dashboard/overview", response_model=schemas.DashboardOverviewResponse)
async def dashboard_overview(
    province: str = Query("", description="省份筛选"),
    city: str = Query("", description="城市筛选"),
    industry: str = Query("", description="行业筛选"),
    year: str = Query("all", description="年份筛选: all/2026/2025/2024/older")
):
    """综合驾驶舱首屏 6 大核心 KPI + 雷达图数据"""
    return dp.get_dashboard_overview(province=province, city=city, industry=industry, year=year)


@app.get("/api/v1/risk/map", response_model=schemas.RiskMapResponse)
async def risk_map(
    region_level: str = Query("province", description="区域层级: province/city"),
    metric: str = Query("credit_env_index", description="指标: credit_env_index/npl_rate")
):
    """区域信用热力图 + 风险脉冲散点"""
    return dp.get_risk_map(region_level, metric)


@app.get("/api/v1/trends")
async def trends(
    indicator: str = Query("npl", description="指标: npl/loan_balance/pmi")
):
    """时间序列趋势 + LSTM 预测 + 置信区间"""
    return dp.get_trends(indicator)


@app.get("/api/v1/industry/graph", response_model=schemas.IndustryGraphResponse)
async def industry_graph(
    industry: str = Query("manufacturing", description="行业: manufacturing/retail/service")
):
    """产业链风险传导图谱"""
    return dp.get_industry_graph(industry)


@app.get("/api/v1/ticker")
async def ticker():
    """滚动预警消息"""
    return dp.get_ticker_messages()


@app.post("/api/v1/policy/simulate", response_model=schemas.PolicyResponse)
async def policy_simulate(req: schemas.PolicyRequest = Body(...)):
    """
    政策模拟推演。
    改为 Body 传参，支持后续扩展。
    """
    return dp.simulate_policy(req.guarantee_rate, req.interest_offset, req.subsidy_level)


@app.get("/api/v1/province/{province_name}", response_model=schemas.ProvinceDetailResponse)
async def province_detail(province_name: str):
    """省份风险画像下钔详情"""
    return dp.get_province_detail(province_name)


@app.get("/api/v1/data/search")
async def data_search(
    q: str = Query("", description="原始数据搜索关键词，如 广东 制造业、深圳 工业、社零"),
    province: str = Query("", description="省份筛选"),
    city: str = Query("", description="城市筛选"),
    industry: str = Query("", description="行业筛选"),
    year: str = Query("all", description="年份筛选: all/2026/2025/2024/older"),
    limit: int = Query(500, ge=1, le=1000, description="返回的最大记录数")
):
    """原始数据检索：面向已导入的真实底表"""
    return dp.search_raw_data(q, limit=limit, year=year, province=province, city=city, industry=industry)


@app.get("/api/v1/data/options")
async def data_options():
    """原始数据筛选项：省份 / 城市 / 行业"""
    return dp.get_raw_data_filter_options()


# ============================================================
# 启动入口
# ============================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
