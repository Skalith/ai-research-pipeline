
from logging.config import fileConfig
from alembic import context
import sys, pathlib
sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))
from app.db.base import Base
from app.models import *  # noqa
from app.core.config import get_settings
settings = get_settings()
config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url_sync)
if config.config_file_name is not None:
    fileConfig(config.config_file_name)
target_metadata = Base.metadata

def run_migrations_offline():
    context.configure(url=config.get_main_option("sqlalchemy.url"), target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle":"named"})
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    # Alembic migrations are synchronous; use the sync URL derived from DATABASE_URL.
    from sqlalchemy import create_engine
    sync_engine = create_engine(settings.database_url_sync)
    try:
        with sync_engine.connect() as conn:
            context.configure(connection=conn, target_metadata=target_metadata)
            with context.begin_transaction():
                context.run_migrations()
    finally:
        sync_engine.dispose()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
