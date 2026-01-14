from pydantic import BaseModel
from typing import Optional

class ChatRequest(BaseModel):
    question: str
    base_dir: str
    webhook_url: Optional[str] = None

class ChatResponse(BaseModel):
    answer: Optional[str] = None
    sources: Optional[list] = None
    job_id: Optional[str] = None
    status: str

class PromptRequest(BaseModel):
    question: str
    base_dir: str

class PromptResponse(BaseModel):
    markdown: str

class TemplateRequest(BaseModel):
    title: str
    template_path: str
    base_dir: str
    destination: Optional[str] = None

class TemplateResponse(BaseModel):
    markdown: str

class WebhookPayload(BaseModel):
    status: str
    result: Optional[dict] = None
    error: Optional[str] = None
    job_id: str

class QueueStatusResponse(BaseModel):
    pending: int
    processing: int
    completed: int
    failed: int
    total: int
    is_processing: bool

class ChatHistoryRequest(BaseModel):
    history_dir: str
    start_date: Optional[str] = None  # ISO format
    end_date: Optional[str] = None  # ISO format

class ChatMessage(BaseModel):
    filename: str
    title: str
    question: str
    answer: str
    timestamp: str

class ChatHistoryResponse(BaseModel):
    messages: list[ChatMessage]

class ReindexRequest(BaseModel):
    base_dir: Optional[str] = None
    partial: bool = False

class ReindexResponse(BaseModel):
    success: bool
    message: str
    output: Optional[str] = None
    error: Optional[str] = None

class SavePromptResponseRequest(BaseModel):
    question: str
    answer: str
    chat_history_dir: str

class SavePromptResponseResponse(BaseModel):
    success: bool
    message: str
    filename: Optional[str] = None
    error: Optional[str] = None

