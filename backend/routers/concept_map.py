from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional

from src.embedder import _get_supabase

router = APIRouter(prefix="/concept-map", tags=["concept-map"])

class ConceptNode(BaseModel):
    id: str
    name: str
    group: int
    val: int
    subject: str
    chapter: str
    is_weak: bool

class ConceptLink(BaseModel):
    source: str
    target: str
    label: str

class ConceptMapResponse(BaseModel):
    nodes: List[ConceptNode]
    links: List[ConceptLink]

@router.get("/", response_model=ConceptMapResponse)
def get_concept_map(subject: Optional[str] = None, chapter_name: Optional[str] = None):
    """
    Returns nodes and edges for the Concept Map.
    If subject or chapter_name is provided, it centers the map on that context,
    returning its topics and any directly connected cross-links.
    """
    client = _get_supabase()
    
    # 1. Fetch chunks for the target context
    query = client.table("neet_chunks").select("metadata")
    if subject:
        # We can't filter jsonb easily without raw SQL in this simple client wrapper,
        # but we can fetch all and filter in memory since we are talking ~1800 rows total.
        pass
    
    res = query.execute()
    
    if not res.data:
        return ConceptMapResponse(nodes=[], links=[])

    # Filter in memory (as jsonb querying via python supabase client can be tricky)
    chunks = res.data
    if subject:
        chunks = [c for c in chunks if c.get("metadata", {}).get("subject") == subject]
    if chapter_name:
        chunks = [c for c in chunks if c.get("metadata", {}).get("chapter") == chapter_name]
        
    # Get distinct topics in the filtered set
    core_topics = set()
    topic_meta = {} # Map topic -> {subject, chapter}
    
    for row in chunks:
        meta = row.get("metadata", {})
        t = meta.get("topic")
        c = meta.get("chapter")
        s = meta.get("subject")
        if t and c and s:
            core_topics.add(t)
            topic_meta[t] = {"subject": s, "chapter": c}
            
    # 2. Fetch confidence status for node coloring
    # We will map confidence status to a group ID (1 to 5)
    conf_res = client.table("chapter_confidence").select("chapter_name, status").execute()
    conf_map = {}
    status_to_group = {
        "not_started": 1,
        "learning": 2,
        "revised": 3,
        "comfortable": 4,
        "confident": 5
    }
    for row in conf_res.data:
        conf_map[row["chapter_name"]] = status_to_group.get(row["status"], 1)
        
    # 3. Fetch reviewed edges that connect to any of our core topics
    # We need edges where topic_a is in core_topics OR topic_b is in core_topics
    edges_res = client.table("concept_edges").select("*").eq("reviewed", True).execute()
    
    links = []
    connected_topics = set()
    
    for row in edges_res.data:
        t_a = row["topic_a"]
        t_b = row["topic_b"]
        note = row["relationship_note"]
        
        # If either topic is in our core focus, we include the edge and the other topic
        if t_a in core_topics or t_b in core_topics:
            links.append(ConceptLink(source=t_a, target=t_b, label=note or ""))
            connected_topics.add(t_a)
            connected_topics.add(t_b)
            
    # 4. We also need metadata for the topics that were pulled in via edges but weren't in the core set.
    # To do this simply, let's just build a global topic_meta from the original full chunks query.
    global_topic_meta = {}
    for row in res.data:
        meta = row.get("metadata", {})
        t = meta.get("topic")
        c = meta.get("chapter")
        s = meta.get("subject")
        if t and c and s:
            global_topic_meta[t] = {"subject": s, "chapter": c}

    # 5. Determine "weak" topics.
    # A topic is weak if it has >= 3 question attempts and < 50% accuracy.
    # Note: question_attempts links to test_questions, which links to chunks (or just chapter_name).
    # Since we can't easily join in supabase-py without RPC, we can fetch all attempts and aggregate.
    
    # Let's fetch test_questions and question_attempts
    tq_res = client.table("test_questions").select("id, chapter_name, chunk_id").execute()
    qa_res = client.table("question_attempts").select("test_question_id, is_correct").execute()
    
    # Map chunk_id to topic (from neet_chunks)
    chunk_to_topic = {}
    # We need to query chunks id and metadata->>topic
    chunk_meta_res = client.table("neet_chunks").select("id, metadata").execute()
    for row in chunk_meta_res.data:
        t = row.get("metadata", {}).get("topic")
        if t:
            chunk_to_topic[row["id"]] = t
            
    # Map question_id to topic
    q_to_topic = {}
    for row in tq_res.data:
        cid = row.get("chunk_id")
        if cid and cid in chunk_to_topic:
            q_to_topic[row["id"]] = chunk_to_topic[cid]
            
    # Aggregate stats per topic
    topic_stats = {}
    for row in qa_res.data:
        qid = row.get("test_question_id")
        is_corr = row.get("is_correct")
        if qid in q_to_topic:
            t = q_to_topic[qid]
            if t not in topic_stats:
                topic_stats[t] = {"attempts": 0, "correct": 0}
            topic_stats[t]["attempts"] += 1
            if is_corr:
                topic_stats[t]["correct"] += 1
                
    weak_topics = set()
    for t, stats in topic_stats.items():
        if stats["attempts"] >= 3:
            accuracy = stats["correct"] / stats["attempts"]
            if accuracy < 0.5:
                weak_topics.add(t)

    # 6. Build final Nodes array
    # We include all core_topics + connected_topics
    all_nodes_to_render = core_topics.union(connected_topics)
    nodes = []
    
    for t in all_nodes_to_render:
        meta = global_topic_meta.get(t, {"subject": "Unknown", "chapter": "Unknown"})
        ch = meta["chapter"]
        sub = meta["subject"]
        group = conf_map.get(ch, 1) # Default to not_started
        is_weak = t in weak_topics
        
        # Node value (size) can just be static or based on connections
        # Let's count connections
        val = sum(1 for link in links if link.source == t or link.target == t)
        val = max(5, val * 3) # Min size 5
        
        nodes.append(ConceptNode(
            id=t,
            name=t,
            group=group,
            val=val,
            subject=sub,
            chapter=ch,
            is_weak=is_weak
        ))

    return ConceptMapResponse(nodes=nodes, links=links)

@router.get("/admin/edges")
def get_pending_edges():
    """
    Returns all unreviewed edges for the Admin UI.
    """
    client = _get_supabase()
    res = client.table("concept_edges").select("*").eq("reviewed", False).order("created_at").execute()
    return {"edges": res.data}

@router.post("/admin/edges/{edge_id}/keep")
def keep_edge(edge_id: int):
    client = _get_supabase()
    client.table("concept_edges").update({"reviewed": True}).eq("id", edge_id).execute()
    return {"status": "ok"}

@router.delete("/admin/edges/{edge_id}/discard")
def discard_edge(edge_id: int):
    client = _get_supabase()
    client.table("concept_edges").delete().eq("id", edge_id).execute()
    return {"status": "ok"}
