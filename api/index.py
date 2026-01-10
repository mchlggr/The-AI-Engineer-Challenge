"""API endpoints for Calendar Club discovery chat."""

import json
import os
from collections.abc import AsyncGenerator

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()

app = FastAPI()

# CORS configuration from environment
ALLOWED_ORIGINS = os.getenv(
    "CORS_ORIGINS", "http://localhost:3000,http://localhost:3001"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_openai_client() -> OpenAI:
    """Lazy-initialize OpenAI client to allow server boot without API key."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")
    return OpenAI(api_key=api_key)


class ChatRequest(BaseModel):
    """Request body for chat endpoint."""

    message: str
    conversation_id: str | None = None


class ConversationMessage(BaseModel):
    """A message in the conversation history."""

    role: str
    content: str


class ChatStreamRequest(BaseModel):
    """Request body for streaming chat endpoint."""

    message: str
    history: list[ConversationMessage] = []


def sse_event(event_type: str, data: dict) -> str:
    """Format a Server-Sent Event."""
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


async def stream_chat_response(
    message: str, history: list[ConversationMessage]
) -> AsyncGenerator[str, None]:
    """Stream chat response using the clarifying agent."""
    try:
        from agents import Runner

        from api.agents import clarifying_agent

        # Build conversation history for the agent
        messages = []
        for msg in history:
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": message})

        # Run the agent with streaming
        result = await Runner.run(
            clarifying_agent,
            messages,
        )

        # Stream the message content
        if result.final_output:
            output = result.final_output
            # Stream the message in chunks for responsiveness
            message_text = output.message
            for i in range(0, len(message_text), 10):
                chunk = message_text[i : i + 10]
                yield sse_event("content", {"text": chunk})

            # Send quick picks if any
            if output.quick_picks:
                quick_picks_data = [
                    {"label": qp.label, "value": qp.value} for qp in output.quick_picks
                ]
                yield sse_event("quick_picks", {"options": quick_picks_data})

            # Send ready_to_search status
            if output.ready_to_search:
                search_profile = None
                if output.search_profile:
                    search_profile = output.search_profile.model_dump()
                yield sse_event(
                    "ready_to_search",
                    {"ready": True, "search_profile": search_profile},
                )

        yield sse_event("done", {})

    except Exception as e:
        yield sse_event("error", {"message": str(e)})
        yield sse_event("done", {})


@app.get("/")
def root():
    """Health check endpoint."""
    return {"status": "ok"}


@app.post("/api/chat")
def chat(request: ChatRequest):
    """Non-streaming chat endpoint (legacy)."""
    client = get_openai_client()
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a friendly event discovery assistant.",
                },
                {"role": "user", "content": request.message},
            ],
        )
        return {"reply": response.choices[0].message.content}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error calling OpenAI API: {str(e)}"
        ) from e


@app.post("/api/chat/stream")
async def chat_stream(request: ChatStreamRequest):
    """Streaming chat endpoint using Server-Sent Events with LLM-orchestrated quick picks."""
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")

    return StreamingResponse(
        stream_chat_response(request.message, request.history),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
