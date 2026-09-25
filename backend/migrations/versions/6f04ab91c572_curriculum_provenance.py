"""Preserve the evidence and assessment used to generate a curriculum."""

from alembic import op
import sqlalchemy as sa


revision = "6f04ab91c572"
down_revision = "3dc1cfb56e62"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("learningpath", sa.Column("generation", sa.JSON(), nullable=False,
                                           server_default=sa.text("'{}'")))
    op.add_column("node", sa.Column("evidence_ids", sa.JSON(), nullable=False,
                                   server_default=sa.text("'[]'")))
    op.alter_column("learningpath", "generation", server_default=None)
    op.alter_column("node", "evidence_ids", server_default=None)


def downgrade():
    op.drop_column("node", "evidence_ids")
    op.drop_column("learningpath", "generation")
