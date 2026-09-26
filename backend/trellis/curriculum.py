"""Preserve the explicit topic structure in a learner's Markdown outline."""

from markdown_it import MarkdownIt


def outline_paths(text: str) -> list[tuple[str, ...]]:
    headings: list[tuple[int, str]] = []
    list_items: list[str | None] = []
    paths = []
    tokens = MarkdownIt().parse(text)

    for index, token in enumerate(tokens):
        if token.type == "list_item_open":
            list_items.append(None)
        elif token.type == "list_item_close":
            list_items.pop()
        elif token.type == "inline":
            previous = tokens[index - 1]
            is_heading = previous.type == "heading_open" and previous.level == 0
            is_list_title = (
                bool(list_items) and list_items[-1] is None
                and previous.type == "paragraph_open"
            )
            if not is_heading and not is_list_title:
                continue

            title_parts = []
            for child in token.children or []:
                if child.type in {"text", "code_inline"}:
                    title_parts.append(child.content)
                elif child.type in {"softbreak", "hardbreak"}:
                    title_parts.append(" ")
            title = " ".join("".join(title_parts).split())
            if is_heading:
                level = int(previous.tag[1:])
                while headings and headings[-1][0] >= level:
                    headings.pop()
                headings.append((level, title if 0 < len(title) <= 200 else ""))
                path = tuple(title for _, title in headings)
            else:
                title = title.split(":", 1)[0].strip()
                list_items[-1] = title if 0 < len(title) <= 200 else ""
                path = tuple(title for _, title in headings) + tuple(
                    title or "" for title in list_items
                )

            # An unrecognized parent cannot give its children a reliable outline path.
            if all(path):
                paths.append(path)

    return paths


def preserves_outline(nodes: list[dict], required: list[tuple[str, ...]]) -> bool:
    required_paths = set(required)
    if len(required_paths) != len(required):
        return False

    matched = []

    def visit(branches: list[dict], ancestors: tuple[str, ...] = ()):
        for node in branches:
            path = ancestors + (node["title"],)
            if path in required_paths:
                matched.append(path)
            visit(node.get("children", []), path)

    visit(nodes)
    return matched == required
