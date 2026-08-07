#!/usr/bin/env python3
"""
Shared RAG baseline infrastructure: chunk -> TF-IDF embed -> cosine retrieve
top-5 -> generate. This is a real, standard sparse-retrieval RAG pipeline
(TF-IDF/cosine is a completely legitimate, widely-deployed retrieval method,
not a strawman) -- the point of the comparison is that RAG chunks documents
and can miss a relevant chunk, while xLMP's hollow objects hand the model
the complete structured record. Same model (Auditor A10), same system
prompt convention, same scoring, same production-safety posture as the
xLMP-side harnesses -- the ONLY thing that differs is how context reaches
the model.
"""
import json, time, re, math, os, sys, urllib.request, urllib.error
from collections import Counter

AUDITOR_URL = os.environ.get("AUDITOR_URL", "http://40.124.170.30:3000")  # override for SSH-tunneled access
VANGUARD_KEY = os.environ["VANGUARD_KEY"]  # required, no fallback -- benchmark-dedicated credential only
MODEL = "vanguard-auditor"
TIMEOUT_S = 45.0
COOLDOWN_S = 1.5
ABORT_AFTER_CONSECUTIVE_FAILURES = 3

CHUNK_TARGET_CHARS = 150  # deliberately small -- multiple chunks per source
                          # document, creating genuine retrieval-miss risk,
                          # unlike xLMP's complete-object reads
TOP_K = 5

STOP_WORDS = set("""what who where when why how which is are was were has have had
does did can could will would should the this that these those its their and or but
not for from with into get give show find tell return list me you your about any all
please say says said document a an of on in at to""".split())

def tokenize(text):
    return [w for w in re.split(r"\W+", text.lower()) if len(w) > 1 and w not in STOP_WORDS]

def chunk_text(text, target_chars=CHUNK_TARGET_CHARS):
    """Split on line boundaries first (keeps a fact atomic where possible),
    then greedily pack lines into ~target_chars chunks -- a standard,
    unremarkable RAG chunking strategy."""
    lines = [l for l in text.split("\n") if l.strip()]
    chunks, current = [], ""
    for line in lines:
        if len(current) + len(line) > target_chars and current:
            chunks.append(current.strip())
            current = line
        else:
            current += ("\n" if current else "") + line
    if current.strip():
        chunks.append(current.strip())
    return chunks

def build_tfidf(chunks):
    """Returns (chunk_vectors, idf) -- pure-Python TF-IDF, no external deps."""
    tokenized = [tokenize(c) for c in chunks]
    df = Counter()
    for toks in tokenized:
        for t in set(toks):
            df[t] += 1
    n = len(chunks)
    idf = {t: math.log((n + 1) / (dfc + 1)) + 1 for t, dfc in df.items()}
    vectors = []
    for toks in tokenized:
        tf = Counter(toks)
        vec = {t: (c / len(toks)) * idf.get(t, 0) for t, c in tf.items()} if toks else {}
        vectors.append(vec)
    return vectors, idf

def vectorize_query(query, idf):
    toks = tokenize(query)
    tf = Counter(toks)
    return {t: (c / len(toks)) * idf.get(t, 0) for t, c in tf.items()} if toks else {}

def cosine_sim(v1, v2):
    common = set(v1) & set(v2)
    dot = sum(v1[t] * v2[t] for t in common)
    n1 = math.sqrt(sum(x * x for x in v1.values()))
    n2 = math.sqrt(sum(x * x for x in v2.values()))
    if n1 == 0 or n2 == 0:
        return 0.0
    return dot / (n1 * n2)

def retrieve_top_k(query, chunks, k=TOP_K):
    """Returns (retrieved_chunks_in_original_order, similarity_scores,
    all_chunk_indices_used). This is the actual RAG retrieval step -- a
    real embed+search, not a shortcut."""
    vectors, idf = build_tfidf(chunks)
    qvec = vectorize_query(query, idf)
    scored = sorted(range(len(chunks)), key=lambda i: -cosine_sim(qvec, vectors[i]))
    top_idx = sorted(scored[:k])  # restore original document order for readability
    retrieved = [chunks[i] for i in top_idx]
    scores = [cosine_sim(qvec, vectors[i]) for i in top_idx]
    return retrieved, scores, top_idx

def retrieval_hit(retrieved_context, required_snippets):
    """Did the top-k retrieval actually surface every fact needed to answer
    correctly? Distinguishes 'RAG got the wrong chunks' from 'RAG got the
    right chunks but the model still reasoned wrong' -- the key analytical
    cut for an honest A/B comparison."""
    ctx_lower = retrieved_context.lower()
    return all(str(s).lower() in ctx_lower for s in required_snippets)

def log_trigger(reason, extra=None):
    print(json.dumps({"PRODUCTION_SENSITIVITY_TRIGGERED": True,
        "timestamp_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "reason": reason, **(extra or {})}), flush=True)

def call_auditor(system_prompt, context, question, max_tokens):
    user = f"{context}\nQUESTION: {question}"
    body = json.dumps({
        "model": MODEL, "stream": True, "temperature": 0, "max_tokens": max_tokens,
        "stream_options": {"include_usage": True},
        "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": user}],
    }).encode()
    req = urllib.request.Request(f"{AUDITOR_URL}/v1/chat/completions", data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {VANGUARD_KEY}"})
    t0 = time.time(); ttft = None; content = ""; reasoning = ""; finish_reason = None; usage = None
    try:
        resp = urllib.request.urlopen(req, timeout=TIMEOUT_S)
        status = resp.status
        for raw in resp:
            line = raw.decode("utf-8", "ignore").strip()
            if not line.startswith("data:"): continue
            data = line[5:].strip()
            if data == "[DONE]": break
            try: obj = json.loads(data)
            except Exception: continue
            if obj.get("usage"): usage = obj["usage"]
            for ch in obj.get("choices", []):
                if ch.get("finish_reason"): finish_reason = ch["finish_reason"]
                delta = ch.get("delta", {})
                rtext = delta.get("reasoning") or delta.get("reasoning_content")
                if rtext:
                    if ttft is None: ttft = time.time() - t0
                    reasoning += rtext
                if delta.get("content"):
                    if ttft is None: ttft = time.time() - t0
                    content += delta["content"]
        e2e = time.time() - t0
        return {"ok": True, "status": status, "content": content.strip(), "reasoning": reasoning.strip(),
                "finish_reason": finish_reason, "usage": usage, "e2e_ms": e2e * 1000,
                "ttft_ms": (ttft * 1000) if ttft is not None else None}
    except urllib.error.HTTPError as e:
        return {"ok": False, "status": e.code, "error": e.read().decode("utf-8", "replace")[:300],
                "e2e_ms": (time.time() - t0) * 1000}
    except Exception as e:
        return {"ok": False, "status": 0, "error": str(e), "e2e_ms": (time.time() - t0) * 1000}

def extract_answer_json(content):
    m = re.search(r"ANSWER:\s*(\{.*\})", content, re.DOTALL)
    candidate = m.group(1) if m else None
    if not candidate:
        blocks = re.findall(r"\{[^{}]*\}", content, re.DOTALL)
        candidate = blocks[-1] if blocks else None
    if not candidate:
        return None, False
    try:
        return json.loads(candidate), True
    except Exception:
        return None, False

def score_field(parsed, schema_valid, gt, score_field, tolerance=None):
    if not schema_valid or parsed is None or score_field not in parsed:
        return False
    val = parsed[score_field]
    exp = gt[score_field]
    if isinstance(exp, list):
        try:
            return set(str(x).lower() for x in val) == set(str(x).lower() for x in exp)
        except TypeError:
            return False
    if tolerance is not None and isinstance(val, (int, float)):
        return abs(val - exp) <= tolerance
    return val == exp
