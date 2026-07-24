from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import require_roles
from app.models.role import RoleName
from app.models.user import User
from app.repositories.report_repository import ReportRepository
from app.schemas.report import (
    DailySalesReport,
    InventoryReportItem,
    MonthlyRevenueReportItem,
    PaginatedSalesReport,
    PaymentMethodReportItem,
    TopProductReportItem,
)
from app.services.report_service import ReportService


router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/daily-sales", response_model=DailySalesReport)
def daily_sales_report(
    target_date: date | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN)),
) -> DailySalesReport:
    return ReportService(ReportRepository(db)).daily_sales(target_date)


@router.get("/sales", response_model=PaginatedSalesReport)
def sales_detail_report(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN)),
) -> PaginatedSalesReport:
    return ReportService(ReportRepository(db)).sales(page, page_size)


@router.get("/inventory", response_model=list[InventoryReportItem])
def inventory_report(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN)),
) -> list[InventoryReportItem]:
    return ReportService(ReportRepository(db)).inventory()


@router.get("/top-products", response_model=list[TopProductReportItem])
def top_products_report(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN)),
) -> list[TopProductReportItem]:
    return ReportService(ReportRepository(db)).top_products()


@router.get("/payment-methods", response_model=list[PaymentMethodReportItem])
def payment_methods_report(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN)),
) -> list[PaymentMethodReportItem]:
    return ReportService(ReportRepository(db)).sales_by_payment_method()


@router.get("/monthly-revenue", response_model=list[MonthlyRevenueReportItem])
def monthly_revenue_report(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleName.ADMIN)),
) -> list[MonthlyRevenueReportItem]:
    return ReportService(ReportRepository(db)).monthly_revenue()
