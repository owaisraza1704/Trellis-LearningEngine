"""Retain exact response and notebook destinations in learning history."""

from alembic import op
import sqlalchemy as sa

revision = "a47d8e290c61"
down_revision = "9b72d630fa14"
branch_labels = None
depends_on = None


def upgrade():
    for column, target in (("interaction_id", "interaction"), ("notebook_item_id", "notebookitem")):
        op.add_column("activity", sa.Column(column, sa.String(), nullable=True))
        op.create_foreign_key(f"fk_activity_{column}", "activity", target,
                              [column], ["id"], ondelete="SET NULL")

    connection = op.get_bind()
    # Only recover unambiguous legacy destinations; repeated labels keep their context fallback.
    connection.execute(sa.text("""
        UPDATE activity AS a SET interaction_id = matches.id
        FROM (
            SELECT a.id AS activity_id, min(i.id) AS id
            FROM activity a JOIN interaction i
              ON a.path_id = i.path_id AND a.node_id = i.node_id
              AND a.thread_id IS NOT DISTINCT FROM i.thread_id
              AND a.label = left(i.prompt, 160) AND i.created_at <= a.created_at
            WHERE a.kind IN ('interaction', 'thread_interaction')
            GROUP BY a.id HAVING count(*) = 1
        ) matches WHERE a.id = matches.activity_id
    """))
    # Legacy notes may have been renamed or deleted. Their labels cannot recover a reliable ID;
    # those events continue to open the journey notebook rather than an unrelated note.


def downgrade():
    op.drop_column("activity", "notebook_item_id")
    op.drop_column("activity", "interaction_id")
