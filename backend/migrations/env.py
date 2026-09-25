from alembic import context

from trellis.db import engine
from trellis import models  # noqa: F401
from sqlmodel import SQLModel


if context.is_offline_mode():
    context.configure(url=str(engine.url), target_metadata=SQLModel.metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=SQLModel.metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()
