from pathlib import Path

def main():
    # Ensure folder exists for sqlite file
    Path("data").mkdir(parents=True, exist_ok=True)

    # IMPORTANT: import model so it registers with Base.metadata
    from src.data.db import Base, engine
    from src.data.models import Transaction  # noqa: F401

    Base.metadata.create_all(bind=engine)
    print("✅ DB initialized. Tables:", list(Base.metadata.tables.keys()))

if __name__ == "__main__":
    main()
