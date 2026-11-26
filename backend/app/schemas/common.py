"""Common response schemas."""
from pydantic import BaseModel, Field, ConfigDict
from typing import Generic, TypeVar, Optional, List
from datetime import datetime

T = TypeVar('T')


class ResponseBase(BaseModel):
    """Base response schema."""
    success: bool = True
    message: str = "Success"
    timestamp: datetime = datetime.utcnow()


class DataResponse(ResponseBase, Generic[T]):
    """Response with data."""
    data: T


class ListResponse(ResponseBase, Generic[T]):
    """Response with list data."""
    data: List[T]
    total: int
    page: int = 1
    page_size: int = 20


class ErrorResponse(ResponseBase):
    """Error response schema."""
    success: bool = False
    error_code: Optional[str] = None
    details: Optional[dict] = None


class PaginationParams(BaseModel):
    """Pagination parameters."""
    page: int = Field(1, ge=1, description="Page number")
    page_size: int = Field(20, ge=1, le=100, description="Items per page")


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated response."""
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int

    model_config = ConfigDict(from_attributes=True)