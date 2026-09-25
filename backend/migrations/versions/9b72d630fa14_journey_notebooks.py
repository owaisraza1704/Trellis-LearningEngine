"""Assign notebook sections and saved study material to their learning journeys."""

from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision = "9b72d630fa14"
down_revision = "6f04ab91c572"
branch_labels = None
depends_on = None


def upgrade():
    for name in ("notebookpage", "studyset", "exportrecord"):
        op.add_column(name, sa.Column("path_id", sa.String(), nullable=True))
        op.create_foreign_key(f"fk_{name}_path_id_learningpath", name, "learningpath", ["path_id"], ["id"])
        op.create_index(f"ix_{name}_path_id", name, ["path_id"])

    connection = op.get_bind()
    metadata = sa.MetaData()
    paths = sa.Table("learningpath", metadata, autoload_with=connection)
    pages = sa.Table("notebookpage", metadata, autoload_with=connection)
    items = sa.Table("notebookitem", metadata, autoload_with=connection)
    studies = sa.Table("studyset", metadata, autoload_with=connection)
    exports = sa.Table("exportrecord", metadata, autoload_with=connection)
    path_ids = set(connection.execute(sa.select(paths.c.id)).scalars())
    page_rows = [dict(row) for row in connection.execute(
        sa.select(pages).order_by(pages.c.position, pages.c.created_at, pages.c.id)
    ).mappings()]
    item_rows = [dict(row) for row in connection.execute(
        sa.select(items).order_by(items.c.position, items.c.created_at, items.c.id)
    ).mappings()]
    study_rows = list(connection.execute(sa.select(studies)).mappings())
    export_rows = list(connection.execute(sa.select(exports)).mappings())

    def recorded_owner(record):
        direct = record.get("path_id")
        inherited = (record.get("origin") or {}).get("path_id")
        if direct in path_ids:
            return direct
        return inherited if inherited in path_ids else None

    item_owners = {item["id"]: recorded_owner(item) for item in item_rows}
    historical_pages = {}
    for export in export_rows:
        for snapshot in export["snapshot"] or []:
            owner = recorded_owner(snapshot)
            if owner and snapshot.get("page_id"):
                historical_pages.setdefault(snapshot["page_id"], set()).add(owner)

    migrated_pages = []
    page_owners = {}
    for page in page_rows:
        contained = [item for item in item_rows if item["page_id"] == page["id"]]
        owners = {item_owners[item["id"]] for item in contained} - {None}
        if not owners:
            owners = historical_pages.get(page["id"], set())
        unique_owner = next(iter(owners)) if len(owners) == 1 else None
        groups = {}
        for item in contained:
            owner = item_owners[item["id"]] or unique_owner
            item_owners[item["id"]] = owner
            groups.setdefault(owner, []).append(item)
        if not groups:
            groups[unique_owner] = []

        # Keep unresolved notes on the original section; split only positively identified groups.
        original_owner = None if None in groups else next(iter(groups))
        for owner, group in groups.items():
            section = dict(page)
            section["path_id"] = owner
            if owner == original_owner:
                connection.execute(pages.update().where(pages.c.id == page["id"]).values(path_id=owner))
            else:
                section["id"] = str(uuid4())
                connection.execute(pages.insert().values(**section))
            migrated_pages.append(section)
            page_owners[section["id"]] = owner
            for position, item in enumerate(group):
                connection.execute(items.update().where(items.c.id == item["id"]).values(
                    page_id=section["id"], path_id=owner, position=position,
                ))

    # Each journey starts its own section order; note and origin IDs remain unchanged.
    positions = {}
    for page in sorted(migrated_pages, key=lambda row: (row["position"], row["created_at"], row["id"])):
        position = positions.get(page["path_id"], 0)
        connection.execute(pages.update().where(pages.c.id == page["id"]).values(position=position))
        positions[page["path_id"]] = position + 1

    export_owners = {}
    for export in export_rows:
        owners = set()
        for snapshot in export["snapshot"] or []:
            owner = recorded_owner(snapshot) or item_owners.get(snapshot.get("id"))
            if owner is None:
                historical = historical_pages.get(snapshot.get("page_id"), set())
                if len(historical) == 1:
                    owner = next(iter(historical))
                elif not historical:
                    owner = page_owners.get(snapshot.get("page_id"))
            owners.add(owner)
        owner = next(iter(owners)) if len(owners) == 1 and None not in owners else None
        export_owners[export["id"]] = owner
        connection.execute(exports.update().where(exports.c.id == export["id"]).values(path_id=owner))

    for study in study_rows:
        selected = study["item_ids"] or []
        owners = {item_owners.get(item_id) for item_id in selected}
        if not selected:
            owners = {
                export_owners[export["id"]]
                for export in export_rows if export["study_session_id"] == study["id"]
            }
        owner = next(iter(owners)) if len(owners) == 1 and None not in owners else None
        connection.execute(studies.update().where(studies.c.id == study["id"]).values(path_id=owner))


def downgrade():
    # Keep split sections and their notes when rolling back ownership; merging could lose material.
    for name in ("exportrecord", "studyset", "notebookpage"):
        op.drop_index(f"ix_{name}_path_id", table_name=name)
        op.drop_constraint(f"fk_{name}_path_id_learningpath", name, type_="foreignkey")
        op.drop_column(name, "path_id")
