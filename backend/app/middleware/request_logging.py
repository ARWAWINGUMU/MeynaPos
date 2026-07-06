import logging
from time import perf_counter

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = perf_counter()
        response = await call_next(request)
        elapsed_ms = (perf_counter() - start) * 1000
        logger.info("%s %s -> %s %.2fms", request.method, request.url.path, response.status_code, elapsed_ms)
        return response

