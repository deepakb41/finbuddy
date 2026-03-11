import argparse

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("cmd", choices=["ingest_sheet", "run_agent"])
    args = parser.parse_args()

    if args.cmd == "ingest_sheet":
        from src.data.ingest import ingest_sheet
        n = ingest_sheet()
        print(f"✅ Ingested {n} rows from Sheets → SQLite.")

    elif args.cmd == "run_agent":
        from src.agents.graph import build_graph, AgentState
        graph = build_graph()
        out = graph.invoke(AgentState())
        print(f"✅ Agent done. Categorized: {out.categorized}")
        print("Top summary rows:", out.summary[:10] if out.summary else None)

if __name__ == "__main__":
    main()
