from fastapi import APIRouter

from app.api.routes import auth, categories, customers, dashboard, inventory, notifications, products, purchases, reports, sales, settings, users
from app.api.routes import open_sales


api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(categories.router)
api_router.include_router(products.router)
api_router.include_router(sales.router)
api_router.include_router(open_sales.router)
api_router.include_router(reports.router)
api_router.include_router(users.router)
api_router.include_router(customers.router)
api_router.include_router(dashboard.router)
api_router.include_router(inventory.router)
api_router.include_router(notifications.router)
api_router.include_router(purchases.router)
api_router.include_router(settings.router)
