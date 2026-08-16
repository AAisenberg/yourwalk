# Score-aware challenger for production (Fly). Build from repo root:
#   fly deploy
# The 102 MB graph pickle is gitignored; the local build context must include it.

FROM python:3.12-slim

WORKDIR /app

COPY pipeline/bakeoff/challenger.py pipeline/bakeoff/graph_runtime.py pipeline/bakeoff/loop_planner.py pipeline/bakeoff/paths.py pipeline/bakeoff/serve_challenger.py /app/bakeoff/
COPY pipeline/data/bakeoff/score_aware_graph.gpickle /app/data/score_aware_graph.gpickle

RUN pip install --no-cache-dir "networkx>=3.3" "shapely>=2.0"

ENV YOURWALK_GRAPH_PICKLE=/app/data/score_aware_graph.gpickle
ENV HOST=0.0.0.0
ENV PORT=8080
ENV PYTHONUNBUFFERED=1

EXPOSE 8080

CMD ["python", "bakeoff/serve_challenger.py"]
