from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field as InputField, model_validator
from sqlalchemy import func
from sqlmodel import Session, select

from . import ai
from .db import get_session
from .models import (
    Activity, Interaction, LearningPath, LearningSession, Node, NotebookItem, Source, Thread, Workspace, utcnow,
)

router = APIRouter()
WITHHELD_ANSWER = "The previous answer was withheld because its support could not be verified."


class RequestBody(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


def require(session: Session, model, record_id: str):
    record = session.get(model, record_id)
    if record is None:
        raise HTTPException(404, f"{model.__name__} not found.")
    return record


def workspace(session: Session) -> Workspace:
    row = session.get(Workspace, 1)
    if row is None:
        row = Workspace()
        session.add(row)
        session.commit()
        session.refresh(row)
    return row


def path_detail(session: Session, path: LearningPath) -> dict:
    nodes = session.exec(select(Node).where(Node.path_id == path.id).order_by(Node.position)).all()
    completed = sum(node.status == "completed" for node in nodes)
    return {
        **path.model_dump(), "nodes": [node.model_dump() for node in nodes],
        "node_count": len(nodes), "completed_count": completed,
        "progress": round(100 * completed / len(nodes)) if nodes else 0,
    }


def activity(session: Session, kind: str, label: str, node: Node | None = None,
             thread: Thread | None = None, path_id: str | None = None):
    session.add(Activity(kind=kind, label=label, path_id=node.path_id if node else path_id,
                         node_id=node.id if node else None, thread_id=thread.id if thread else None))
    if node or path_id:
        path = require(session, LearningPath, node.path_id if node else path_id)
        path.updated_at = utcnow()
        session.add(path)
    period = session.exec(select(LearningSession).where(LearningSession.ended_at.is_(None))
                          .order_by(LearningSession.started_at.desc())).first()
    if period:
        period.last_active_at = utcnow()
        session.add(period)


def safe_thread_seed(session: Session, thread: Thread) -> str:
    # Older threads copied withheld diagnostics before seeds distinguished accepted answers.
    sources = session.exec(select(Interaction).where(
        Interaction.node_id == thread.node_id, Interaction.thread_id.is_(None),
        Interaction.status == "abstained",
    )).all()
    for source in sources:
        suffix = f"\nStarting question: {source.prompt}\nStarting explanation: {source.content}"
        if thread.seed_context.endswith(suffix):
            return (thread.seed_context.removesuffix(suffix)
                    + f"\nStarting question: {source.prompt}\nStarting explanation: {WITHHELD_ANSWER}")
    return thread.seed_context


def build_context(session: Session, node: Node, thread: Thread | None = None) -> dict:
    path = require(session, LearningPath, node.path_id)
    query = select(Interaction).where(Interaction.node_id == node.id)
    query = query.where(Interaction.thread_id == thread.id) if thread else query.where(
        Interaction.thread_id.is_(None)
    )
    interactions = session.exec(query.order_by(Interaction.created_at.desc()).limit(12)).all()
    ancestors = []
    parent_id = node.parent_id
    while parent_id:
        parent = require(session, Node, parent_id)
        ancestors.insert(0, {"title": parent.title, "description": parent.description})
        parent_id = parent.parent_id
    context = {
        "path_id": path.id, "path_title": path.title, "node_id": node.id,
        "node_title": node.title, "node_description": node.description,
        "node_position": node.position,
        "node_count": session.exec(select(func.count()).select_from(Node).where(Node.path_id == path.id)).one(),
        "ancestors": ancestors, "progress": path_detail(session, path)["progress"],
        "history": [{"prompt": item.prompt,
                     "content": item.content if item.status != "abstained" else WITHHELD_ANSWER}
                    for item in reversed(interactions)],
    }
    if thread:
        context.update(thread_id=thread.id, thread_title=thread.title,
                       seed_context=safe_thread_seed(session, thread))
    return context


class PathInput(RequestBody):
    input: str = InputField(min_length=3, max_length=20000)
    mode: Literal["goal", "outline"] = "goal"
    source_ids: list[str] = InputField(default_factory=list, max_length=30)


class DraftNode(RequestBody):
    title: str = InputField(min_length=1, max_length=300)
    description: str = InputField(default="", max_length=5000)
    parent_index: int | None = None
    evidence_ids: list[str] = InputField(default_factory=list)


class CurriculumDraft(RequestBody):
    title: str = InputField(min_length=1, max_length=300)
    description: str = ""
    nodes: list[DraftNode] = InputField(min_length=1, max_length=100)

    @model_validator(mode="after")
    def ordered_hierarchy(self):
        for index, node in enumerate(self.nodes):
            if node.parent_index is not None and not 0 <= node.parent_index < index:
                raise ValueError("A parent must be a preceding node.")
        return self


class PathEdit(RequestBody):
    title: str | None = InputField(default=None, min_length=1, max_length=300)
    description: str | None = InputField(default=None, max_length=5000)


class NodeInput(RequestBody):
    title: str = InputField(min_length=1, max_length=300)
    description: str = InputField(default="", max_length=5000)
    parent_id: str | None = None


class NodeEdit(PathEdit):
    parent_id: str | None = None


class ReorderInput(RequestBody):
    node_ids: list[str]


class ProgressInput(RequestBody):
    status: Literal["not_started", "in_progress", "completed"]


class MessageInput(RequestBody):
    prompt: str = InputField(min_length=1, max_length=12000)
    action: Literal["foundation", "question", "example", "deeper", "comparison", "application"] = "question"


class ThreadInput(RequestBody):
    title: str = InputField(min_length=1, max_length=300)
    interaction_id: str | None = None


class ThreadEdit(RequestBody):
    title: str | None = InputField(default=None, min_length=1, max_length=300)
    status: Literal["open", "closed"] | None = None


class LocationInput(RequestBody):
    path_id: str | None = None
    node_id: str | None = None
    thread_id: str | None = None


@router.get("/paths")
def list_paths(session: Session = Depends(get_session)):
    paths = session.exec(select(LearningPath).order_by(LearningPath.updated_at.desc())).all()
    return [{key: value for key, value in path_detail(session, path).items()
             if key not in {"nodes", "generation"}}
            for path in paths]


@router.get("/workspace")
def get_workspace(session: Session = Depends(get_session)):
    location = workspace(session)
    paths = list_paths(session)
    path = session.get(LearningPath, location.path_id) if location.path_id else None
    node = session.get(Node, location.node_id) if location.node_id else None
    thread = session.get(Thread, location.thread_id) if location.thread_id else None
    return {"paths": paths, "location": location.model_dump(exclude={"id"}),
            "location_detail": {"path_title": path.title if path else None,
                                "node_title": node.title if node else None,
                                "thread_title": thread.title if thread else None}, "stats": {
        "paths": len(paths), "nodes": sum(path["node_count"] for path in paths),
        "completed": sum(path["completed_count"] for path in paths),
        "notebook_items": session.exec(select(func.count()).select_from(NotebookItem)).one(),
    }}


@router.post("/paths", status_code=201)
def create_path(body: PathInput, session: Session = Depends(get_session)):
    sources = [require(session, Source, source_id) for source_id in set(body.source_ids)]
    if any(source.path_id for source in sources):
        raise HTTPException(409, "Select unattached sources for a new journey.")
    if any(source.status != "ready" for source in sources):
        raise HTTPException(409, "Wait for all selected sources to finish indexing.")
    from pydantic import ValidationError
    try:
        generated = ai.generate_curriculum(session, body.input, body.mode, body.source_ids)
        draft = CurriculumDraft.model_validate(generated)
    except ValidationError as error:
        raise HTTPException(502, "The model returned an invalid curriculum. Please try again.") from error
    for evidence in generated.get("evidence", []):
        source = session.get(Source, evidence.get("source_id"))
        if source and source.path_id is None and source not in sources:
            sources.append(source)
    path = LearningPath(title=draft.title, description=draft.description, input=body.input,
                        generation=generated.get("generation", {}))
    session.add(path)
    session.flush()
    nodes = []
    for position, item in enumerate(draft.nodes):
        node = Node(path_id=path.id, title=item.title, description=item.description,
                    parent_id=nodes[item.parent_index].id if item.parent_index is not None else None,
                    position=position, evidence_ids=item.evidence_ids)
        session.add(node)
        session.flush()
        nodes.append(node)
    for source in sources:
        source.path_id = path.id
        session.add(source)
    location = session.get(Workspace, 1) or Workspace()
    location.path_id, location.node_id, location.thread_id = path.id, nodes[0].id, None
    session.add(location)
    activity(session, "path_created", f"Created {path.title}", path_id=path.id)
    session.commit()
    return path_detail(session, path)


@router.get("/paths/{path_id}")
def get_path(path_id: str, session: Session = Depends(get_session)):
    return path_detail(session, require(session, LearningPath, path_id))


@router.patch("/paths/{path_id}")
def edit_path(path_id: str, body: PathEdit, session: Session = Depends(get_session)):
    path = require(session, LearningPath, path_id)
    for key, value in body.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(path, key, value)
    path.updated_at = utcnow()
    session.add(path)
    session.commit()
    return path_detail(session, path)


@router.post("/paths/{path_id}/nodes", status_code=201)
def add_node(path_id: str, body: NodeInput, session: Session = Depends(get_session)):
    require(session, LearningPath, path_id)
    if body.parent_id and require(session, Node, body.parent_id).path_id != path_id:
        raise HTTPException(422, "Parent must belong to this journey.")
    count = session.exec(select(func.count()).select_from(Node).where(Node.path_id == path_id)).one()
    node = Node(path_id=path_id, position=count, **body.model_dump())
    session.add(node)
    activity(session, "node_added", f"Added {node.title}", path_id=path_id)
    session.commit()
    session.refresh(node)
    return node


@router.patch("/nodes/{node_id}")
def edit_node(node_id: str, body: NodeEdit, session: Session = Depends(get_session)):
    node = require(session, Node, node_id)
    if "parent_id" in body.model_fields_set:
        parent_id = body.parent_id
        while parent_id:
            if parent_id == node.id:
                raise HTTPException(422, "A node cannot be its own ancestor.")
            parent = require(session, Node, parent_id)
            if parent.path_id != node.path_id:
                raise HTTPException(422, "Parent must belong to this journey.")
            parent_id = parent.parent_id
        node.parent_id = body.parent_id
    for key, value in body.model_dump(exclude_unset=True, exclude_none=True, exclude={"parent_id"}).items():
        setattr(node, key, value)
    session.add(node)
    activity(session, "node_edited", f"Updated {node.title}", node=node)
    session.commit()
    session.refresh(node)
    return node


@router.delete("/nodes/{node_id}", status_code=204)
def delete_node(node_id: str, session: Session = Depends(get_session)):
    node = require(session, Node, node_id)
    has_children = session.exec(select(Node.id).where(Node.parent_id == node_id)).first()
    has_history = session.exec(select(Interaction.id).where(Interaction.node_id == node_id)).first()
    has_threads = session.exec(select(Thread.id).where(Thread.node_id == node_id)).first()
    has_notes = session.exec(select(NotebookItem.id).where(NotebookItem.node_id == node_id)).first()
    if has_children or has_history or has_threads or has_notes or node.status != "not_started":
        raise HTTPException(409, "Only empty, unstarted nodes without children can be removed. Existing learning history is retained.")
    count = session.exec(select(func.count()).select_from(Node).where(Node.path_id == node.path_id)).one()
    if count == 1:
        raise HTTPException(409, "A journey must retain at least one node.")
    location = workspace(session)
    if location.node_id == node.id:
        location.node_id = None
        location.thread_id = None
        session.add(location)
    for event in session.exec(select(Activity).where(Activity.node_id == node.id)).all():
        event.node_id = None
        session.add(event)
    for period in session.exec(select(LearningSession).where(LearningSession.node_id == node.id)).all():
        period.node_id = None
        session.add(period)
    activity(session, "node_removed", f"Removed {node.title}", path_id=node.path_id)
    session.delete(node)
    session.flush()
    nodes = session.exec(select(Node).where(Node.path_id == node.path_id).order_by(Node.position)).all()
    for position, item in enumerate(nodes):
        item.position = position
        session.add(item)
    session.commit()
    return Response(status_code=204)


@router.post("/paths/{path_id}/reorder")
def reorder_nodes(path_id: str, body: ReorderInput, session: Session = Depends(get_session)):
    path = require(session, LearningPath, path_id)
    nodes = session.exec(select(Node).where(Node.path_id == path_id)).all()
    if len(body.node_ids) != len(nodes) or set(body.node_ids) != {node.id for node in nodes}:
        raise HTTPException(422, "Provide every node exactly once when reordering.")
    positions = {node_id: position for position, node_id in enumerate(body.node_ids)}
    for node in nodes:
        node.position = positions[node.id]
        session.add(node)
    activity(session, "path_reordered", f"Reordered {path.title}", path_id=path_id)
    session.commit()
    return path_detail(session, path)


@router.get("/nodes/{node_id}")
def get_node(node_id: str, session: Session = Depends(get_session)):
    node = require(session, Node, node_id)
    path = path_detail(session, require(session, LearningPath, node.path_id))
    return {"node": node, "path": {key: value for key, value in path.items() if key != "nodes"},
            "nodes": path["nodes"], "threads": session.exec(select(Thread).where(Thread.node_id == node_id)
                .order_by(Thread.created_at)).all(),
            "interactions": session.exec(select(Interaction).where(Interaction.node_id == node_id,
                Interaction.thread_id.is_(None)).order_by(Interaction.created_at)).all()}


@router.patch("/nodes/{node_id}/progress")
def update_progress(node_id: str, body: ProgressInput, session: Session = Depends(get_session)):
    node = require(session, Node, node_id)
    node.status = body.status
    session.add(node)
    activity(session, "progress", f"{node.title}: {body.status.replace('_', ' ')}", node=node)
    session.commit()
    session.refresh(node)
    return node


def interact(session: Session, node: Node, body: MessageInput, thread: Thread | None = None):
    if thread and thread.status == "closed":
        raise HTTPException(409, "Reopen this thread before adding a message.")
    result = ai.answer(session, build_context(session, node, thread), body.prompt)
    interaction = Interaction(path_id=node.path_id, node_id=node.id,
                              thread_id=thread.id if thread else None, prompt=body.prompt,
                              action=body.action, **result)
    session.add(interaction)
    # Thread conversations never mutate primary-node progress or location.
    if not thread and node.status == "not_started":
        node.status = "in_progress"
        session.add(node)
    activity(session, "thread_interaction" if thread else "interaction", body.prompt[:160],
             node=node, thread=thread)
    session.commit()
    session.refresh(interaction)
    return interaction


@router.post("/nodes/{node_id}/interactions", status_code=201)
def node_interaction(node_id: str, body: MessageInput, session: Session = Depends(get_session)):
    return interact(session, require(session, Node, node_id), body)


@router.post("/nodes/{node_id}/threads", status_code=201)
def create_thread(node_id: str, body: ThreadInput, session: Session = Depends(get_session)):
    node = require(session, Node, node_id)
    seed = f"Origin topic: {node.title}. {node.description}"
    if body.interaction_id:
        source = require(session, Interaction, body.interaction_id)
        if source.node_id != node.id or source.thread_id:
            raise HTTPException(422, "Start a thread from a response in this primary node.")
        explanation = source.content if source.status != "abstained" else WITHHELD_ANSWER
        seed += f"\nStarting question: {source.prompt}\nStarting explanation: {explanation}"
    thread = Thread(node_id=node.id, path_id=node.path_id, title=body.title, seed_context=seed)
    session.add(thread)
    session.flush()
    activity(session, "thread_created", f"Exploring {thread.title}", node=node, thread=thread)
    session.commit()
    session.refresh(thread)
    return thread


@router.get("/threads/{thread_id}")
def get_thread(thread_id: str, session: Session = Depends(get_session)):
    thread = require(session, Thread, thread_id)
    node = require(session, Node, thread.node_id)
    return {"thread": thread, "node": node, "path": require(session, LearningPath, thread.path_id),
            "interactions": session.exec(select(Interaction).where(Interaction.thread_id == thread_id)
                .order_by(Interaction.created_at)).all()}


@router.patch("/threads/{thread_id}")
def edit_thread(thread_id: str, body: ThreadEdit, session: Session = Depends(get_session)):
    thread = require(session, Thread, thread_id)
    for key, value in body.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(thread, key, value)
    session.add(thread)
    session.commit()
    session.refresh(thread)
    return thread


@router.post("/threads/{thread_id}/interactions", status_code=201)
def thread_interaction(thread_id: str, body: MessageInput, session: Session = Depends(get_session)):
    thread = require(session, Thread, thread_id)
    return interact(session, require(session, Node, thread.node_id), body, thread)


@router.put("/location")
def set_location(body: LocationInput, session: Session = Depends(get_session)):
    location = workspace(session)
    if body.path_id and "node_id" not in body.model_fields_set:
        if location.path_id == body.path_id:
            body.node_id, body.thread_id = location.node_id, location.thread_id
        else:
            previous = session.exec(select(LearningSession).where(
                LearningSession.path_id == body.path_id
            ).order_by(LearningSession.last_active_at.desc())).first()
            if previous:
                body.node_id, body.thread_id = previous.node_id, previous.thread_id
    if body.path_id:
        require(session, LearningPath, body.path_id)
    if body.node_id:
        node = require(session, Node, body.node_id)
        if node.path_id != body.path_id:
            raise HTTPException(422, "The node must belong to the selected journey.")
    if body.thread_id:
        thread = require(session, Thread, body.thread_id)
        if thread.node_id != body.node_id or thread.path_id != body.path_id:
            raise HTTPException(422, "The thread must belong to the selected node.")
    for key, value in body.model_dump().items():
        setattr(location, key, value)
    session.add(location)
    period = session.exec(select(LearningSession).where(LearningSession.ended_at.is_(None))
                          .order_by(LearningSession.started_at.desc())).first()
    if body.path_id:
        if period and period.path_id != body.path_id:
            period.ended_at = utcnow()
            session.add(period)
            period = None
        if period is None:
            period = LearningSession(path_id=body.path_id)
        period.path_id, period.node_id, period.thread_id = body.path_id, body.node_id, body.thread_id
        period.last_active_at = utcnow()
        session.add(period)
    session.commit()
    return body


@router.get("/history")
def history(session: Session = Depends(get_session)):
    return session.exec(select(Activity).order_by(Activity.created_at.desc()).limit(300)).all()


@router.get("/learning-sessions")
def learning_sessions(session: Session = Depends(get_session)):
    return session.exec(select(LearningSession).order_by(LearningSession.started_at.desc())).all()


@router.post("/learning-sessions/end")
def end_learning_session(session: Session = Depends(get_session)):
    period = session.exec(select(LearningSession).where(LearningSession.ended_at.is_(None))
                          .order_by(LearningSession.started_at.desc())).first()
    if period:
        period.ended_at = utcnow()
        period.last_active_at = period.ended_at
        session.add(period)
        session.commit()
        session.refresh(period)
    return period
