from src.data.db import Base, engine
from src.data.models import Transaction

def main():
    Base.metadata.create_all(bind=engine)
    print("✅ DB initialized.")

if __name__ == "__main__":
    main()
