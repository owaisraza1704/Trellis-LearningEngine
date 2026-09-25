"""Exercise real local API integrations. Creates a retained demonstration journey."""

import argparse
import io
import json
import time
from pathlib import Path

import httpx
from pypdf import PdfReader

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--base-url", default="http://127.0.0.1:8100/api")
parser.add_argument("--path-id", help="Reuse a previous verification journey instead of creating another")
args = parser.parse_args()
output = Path(__file__).resolve().parents[1] / ".data" / "verification"
output.mkdir(parents=True, exist_ok=True)
timings = {}
records = {}


with httpx.Client(base_url=args.base_url, timeout=240) as client:
    def request(method, path, **kwargs):
        start = time.monotonic()
        response = client.request(method, path, **kwargs)
        response.raise_for_status()
        timings[f"{method} {path}"] = round(time.monotonic() - start, 2)
        return response.json()

    assert request("GET", "/health")["status"] == "ok"
    configuration = request("GET", "/settings")
    records["provider"] = configuration["provider"]
    records["model"] = configuration["model"]
    if args.path_id:
        path = request("GET", f"/paths/{args.path_id}")
        source = next(source for source in request("GET", "/sources", params={"path_id": path["id"]})
                      if source["url"] == "https://docs.python.org/3/tutorial/datastructures.html")
    else:
        print("Indexing an official Python source...", flush=True)
        source = request("POST", "/sources/url", json={
            "url": "https://docs.python.org/3/tutorial/datastructures.html",
        })
        deadline = time.monotonic() + 180
        while time.monotonic() < deadline:
            source = request("GET", f"/sources/{source['id']}")
            if source["status"] in {"ready", "failed"}:
                break
            time.sleep(1)
        assert source["status"] == "ready", {"status": source["status"], "error": source["error"]}
        print("Generating a journey using the supplied documentation...", flush=True)
        path = request("POST", "/paths", json={
            "input": "Learn Python lists and tuples using the supplied Python documentation",
            "source_ids": [source["id"]],
        })
    records["source_id"] = source["id"]
    records["path_id"] = path["id"]
    node = next((item for item in path["nodes"] if "list" in item["title"].lower()), path["nodes"][0])
    records["node_id"] = node["id"]
    location = {"path_id": path["id"], "node_id": node["id"], "thread_id": None}
    request("PUT", "/location", json=location)
    print("Generating and evaluating a source-backed node answer...", flush=True)
    answer = request("POST", f"/nodes/{node['id']}/interactions", json={
        "prompt": "Explain list.append and list.pop from the supplied documentation.",
    })
    assert answer["status"] == "answered", answer
    assert answer["evidence"] and all(item["source_id"] == source["id"] for item in answer["evidence"])
    assert answer["evaluation"]["status"] == "passed", answer["evaluation"]
    records["interaction_id"] = answer["id"]
    records["evaluation"] = answer["evaluation"]
    before = request("GET", f"/nodes/{node['id']}")
    thread = request("POST", f"/nodes/{node['id']}/threads", json={
        "title": "Tuple comparison", "interaction_id": answer["id"],
    })
    records["thread_id"] = thread["id"]
    print("Testing an independent exploratory thread...", flush=True)
    tangent = request("POST", f"/threads/{thread['id']}/interactions", json={
        "prompt": "According to the documentation, how do tuples differ from lists?",
    })
    # Abstention is the correct outcome if a model introduces an unsupported detail.
    assert tangent["status"] in {"answered", "abstained"}
    if tangent["status"] == "answered":
        assert tangent["evidence"] and tangent["evaluation"]["status"] == "passed"
    else:
        assert tangent["evaluation"]["status"] != "passed"
    records["thread_status"] = tangent["status"]
    records["thread_evaluation"] = tangent["evaluation"]
    after = request("GET", f"/nodes/{node['id']}")
    assert before["interactions"] == after["interactions"]
    assert before["node"] == after["node"]
    assert request("GET", "/workspace")["location"] == location
    request("PATCH", f"/nodes/{node['id']}/progress", json={"status": "completed"})
    page = request("POST", "/notebook/pages", json={
        "path_id": path["id"], "title": "Python source-backed study notes",
    })
    saved = request("POST", "/notebook/items", json={
        "page_id": page["id"], "interaction_id": answer["id"], "title": "List append and pop",
    })
    note = request("POST", "/notebook/items", json={
        "page_id": page["id"], "node_id": node["id"], "title": "Practice reminder",
        "content": "Practice adding an item with append and removing it with pop.",
    })
    request("POST", "/notebook/items", json={
        "page_id": page["id"], "title": "Not selected", "content": "UNSELECTED_PRIVATE_MARKER",
    })
    selection = [note["id"], saved["id"]]
    study = request("POST", "/study-sessions", json={
        "path_id": path["id"], "title": "Python review", "item_ids": selection,
    })
    print("Exporting and reopening selected study material...", flush=True)
    export = request("POST", "/exports", json={
        "path_id": path["id"], "title": "Python review", "item_ids": selection,
        "study_session_id": study["id"],
    })
    assert export["status"] == "completed", export
    pdf = client.get(f"/exports/{export['id']}/download")
    pdf.raise_for_status()
    (output / "live-study.pdf").write_bytes(pdf.content)
    reader = PdfReader(io.BytesIO(pdf.content))
    text = "\n".join(page.extract_text() for page in reader.pages)
    assert "UNSELECTED_PRIVATE_MARKER" not in text
    assert "Practice reminder" in text and "List append and pop" in text
    assert text.index("Practice reminder") < text.index("List append and pop")
    assert "docs.python.org" in text
    records.update(page_id=page["id"], study_session_id=study["id"], export_id=export["id"],
                   pdf_pages=len(reader.pages), location=location)
    records["timings_seconds"] = timings
    (output / "live-api.json").write_text(json.dumps(records, indent=2))
    print(json.dumps({"result": "passed", **records}, indent=2), flush=True)
