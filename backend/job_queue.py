from queue import Queue
from enum import Enum
from dataclasses import dataclass
from typing import Optional, Dict
import uuid
import threading

class JobStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class Job:
    job_id: str
    status: JobStatus
    command: str
    base_dir: str
    question: Optional[str] = None
    result: Optional[dict] = None
    error: Optional[str] = None
    webhook_url: Optional[str] = None

class JobQueue:
    def __init__(self):
        self.queue: Queue = Queue()
        self.jobs: Dict[str, Job] = {}
        self.processing = False
        self.lock = threading.Lock()
    
    def add_job(self, command: str, base_dir: str, question: Optional[str] = None, webhook_url: Optional[str] = None) -> str:
        """Adiciona um job à fila e retorna o job_id"""
        job_id = str(uuid.uuid4())
        job = Job(
            job_id=job_id,
            status=JobStatus.PENDING,
            command=command,
            base_dir=base_dir,
            question=question,
            webhook_url=webhook_url
        )
        self.jobs[job_id] = job
        self.queue.put(job_id)
        return job_id
    
    def get_job(self, job_id: str) -> Optional[Job]:
        """Retorna um job pelo ID"""
        return self.jobs.get(job_id)
    
    def update_job_status(self, job_id: str, status: JobStatus, result: Optional[dict] = None, error: Optional[str] = None):
        """Atualiza o status de um job"""
        if job_id in self.jobs:
            job = self.jobs[job_id]
            job.status = status
            if result:
                job.result = result
            if error:
                job.error = error
    
    def get_queue_status(self) -> dict:
        """Retorna o status da fila"""
        pending = sum(1 for j in self.jobs.values() if j.status == JobStatus.PENDING)
        processing = sum(1 for j in self.jobs.values() if j.status == JobStatus.PROCESSING)
        completed = sum(1 for j in self.jobs.values() if j.status == JobStatus.COMPLETED)
        failed = sum(1 for j in self.jobs.values() if j.status == JobStatus.FAILED)
        
        return {
            "pending": pending,
            "processing": processing,
            "completed": completed,
            "failed": failed,
            "total": len(self.jobs),
            "is_processing": self.processing
        }

