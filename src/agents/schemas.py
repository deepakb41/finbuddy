from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional


class CategorizationResult(BaseModel):
    category: str = Field(..., description="Must be one of the allowed categories provided.")
    merchant_normalized: Optional[str] = Field(None, description="Best canonical merchant name.")
    confidence: float = Field(..., ge=0.0, le=1.0)
    explanation: str = Field(..., description="Short reason for the classification.")
