"""Zone REST API routes."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.services.zone_service import ZoneService
from app.schemas.zone import ZoneCreate, ZoneUpdate, ZoneResponse, ZoneWithStats
from app.schemas.common import PaginationParams, PaginatedResponse, DataResponse, ListResponse

router = APIRouter(prefix="/zones", tags=["Zones"])


def get_zone_service(db: Session = Depends(get_db)) -> ZoneService:
    return ZoneService(db)


@router.post(
    "/",
    response_model=DataResponse[ZoneResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a new zone",
)
def create_zone(
    zone_data: ZoneCreate,
    service: ZoneService = Depends(get_zone_service),
):
    """Create a new restricted zone."""
    # Check if zone name already exists
    existing = service.get_by_name(zone_data.zone_name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Zone with name '{zone_data.zone_name}' already exists",
        )

    zone = service.create(zone_data)
    return DataResponse(data=zone, message="Zone created successfully")


@router.get(
    "/",
    response_model=ListResponse[ZoneResponse],
    summary="List all zones",
)
def list_zones(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by zone name"),
    service: ZoneService = Depends(get_zone_service),
):
    """List all zones with pagination and search."""
    params = PaginationParams(page=page, page_size=page_size)
    zones = service.get_all(skip=(page - 1) * page_size, limit=page_size, search=search)
    total = service.get_count(search=search)

    return ListResponse(
        data=zones,
        total=total,
        page=page,
        page_size=page_size,
        message="Zones retrieved successfully",
    )


@router.get(
    "/stats",
    response_model=ListResponse[ZoneWithStats],
    summary="List all zones with statistics",
)
def list_zones_with_stats(
    service: ZoneService = Depends(get_zone_service),
):
    """List all zones with camera and detection statistics."""
    zones = service.get_all_with_stats()
    return ListResponse(data=zones, total=len(zones), message="Zones with stats retrieved successfully")


@router.get(
    "/{zone_id}",
    response_model=DataResponse[ZoneResponse],
    summary="Get zone by ID",
)
def get_zone(
    zone_id: int,
    service: ZoneService = Depends(get_zone_service),
):
    """Get a specific zone by ID."""
    zone = service.get_by_id(zone_id)
    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Zone with ID {zone_id} not found",
        )
    return DataResponse(data=zone, message="Zone retrieved successfully")


@router.get(
    "/{zone_id}/stats",
    response_model=DataResponse[ZoneWithStats],
    summary="Get zone with statistics",
)
def get_zone_stats(
    zone_id: int,
    service: ZoneService = Depends(get_zone_service),
):
    """Get a specific zone with camera and detection statistics."""
    zone = service.get_with_stats(zone_id)
    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Zone with ID {zone_id} not found",
        )
    return DataResponse(data=zone, message="Zone stats retrieved successfully")


@router.put(
    "/{zone_id}",
    response_model=DataResponse[ZoneResponse],
    summary="Update a zone",
)
def update_zone(
    zone_id: int,
    zone_data: ZoneUpdate,
    service: ZoneService = Depends(get_zone_service),
):
    """Update a zone."""
    # Check if new name conflicts
    if zone_data.zone_name:
        existing = service.get_by_name(zone_data.zone_name)
        if existing and existing.id != zone_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Zone with name '{zone_data.zone_name}' already exists",
            )

    zone = service.update(zone_id, zone_data)
    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Zone with ID {zone_id} not found",
        )
    return DataResponse(data=zone, message="Zone updated successfully")


@router.delete(
    "/{zone_id}",
    response_model=DataResponse[dict],
    summary="Delete a zone",
)
def delete_zone(
    zone_id: int,
    service: ZoneService = Depends(get_zone_service),
):
    """Delete a zone."""
    success = service.delete(zone_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Zone with ID {zone_id} not found",
        )
    return DataResponse(data={"deleted": True}, message="Zone deleted successfully")