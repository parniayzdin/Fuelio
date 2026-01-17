from datetime import datetime
from typing import Optional
from sqlalchemy import String, Float, Boolean, DateTime, ForeignKey, Text, Date, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base
import uuid


def generate_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Nullable for OAuth users
    google_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True, index=True)  # Google OAuth ID
    tos_accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    vehicle: Mapped[Optional["Vehicle"]] = relationship(back_populates="user", uselist=False)
    trips: Mapped[list["Trip"]] = relationship(back_populates="user")
    fillups: Mapped[list["Fillup"]] = relationship(back_populates="user")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="user")


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), unique=True)
    tank_size_liters: Mapped[float] = mapped_column(Float, default=50.0)
    efficiency_l_per_100km: Mapped[float] = mapped_column(Float, default=8.5)
    reserve_fraction: Mapped[float] = mapped_column(Float, default=0.1)
    default_region_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("regions.id"), nullable=True)

    make: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    model: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    year: Mapped[Optional[int]] = mapped_column(Float, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    fuel_type: Mapped[Optional[str]] = mapped_column(String(20), default="regular", nullable=True)

    user: Mapped["User"] = relationship(back_populates="vehicle")


class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    start_location_lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    start_location_lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    end_location_lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    end_location_lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    distance_km: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    start_address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    end_address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    user: Mapped["User"] = relationship(back_populates="trips")


class Fillup(Base):
    __tablename__ = "fillups"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    full_tank_bool: Mapped[bool] = mapped_column(Boolean, default=True)
    fuel_percent_optional: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    liters_optional: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    user: Mapped["User"] = relationship(back_populates="fillups")


class Region(Base):
    __tablename__ = "regions"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    prices: Mapped[list["Price"]] = relationship(back_populates="region")


class Price(Base):
    __tablename__ = "prices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    region_id: Mapped[str] = mapped_column(String(50), ForeignKey("regions.id"), index=True)
    day: Mapped[datetime] = mapped_column(Date, nullable=False, index=True)
    avg_price_per_liter: Mapped[float] = mapped_column(Float, nullable=False)

    region: Mapped["Region"] = relationship(back_populates="prices")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    decision: Mapped[str] = mapped_column(String(20), nullable=False)  # FILL or NO_ACTION
    severity: Mapped[str] = mapped_column(String(20), nullable=False)  # low, medium, high
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="new")  # new, acknowledged

    user: Mapped["User"] = relationship(back_populates="alerts")
    notifications: Mapped[list["Notification"]] = relationship(back_populates="alert")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    alert_id: Mapped[str] = mapped_column(String(36), ForeignKey("alerts.id"), index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    type: Mapped[str] = mapped_column(String(20), default="push")  # push, email, sms
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, sent, failed
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    alert: Mapped["Alert"] = relationship(back_populates="notifications")


class GasStation(Base):
    __tablename__ = "gas_stations"

    place_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    brand: Mapped[str] = mapped_column(String(100), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    regular: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    premium: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    diesel: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    last_updated: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    rating: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    user_ratings_total: Mapped[Optional[float]] = mapped_column(Float, nullable=True)


