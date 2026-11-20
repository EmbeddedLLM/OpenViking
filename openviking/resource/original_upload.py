# Copyright (c) 2026 Beijing Volcano Engine Technology Co., Ltd.
# SPDX-License-Identifier: AGPL-3.0
"""Original bytes attached to an uploaded resource, outside its managed parse tree."""

from __future__ import annotations

import asyncio
import re
from pathlib import Path
from typing import Any

from openviking.pyagfs.exceptions import AGFSNotFoundError
from openviking.server.identity import RequestContext
from openviking.storage.acl import AclSpec
from openviking.storage.internal_names import ORIGINAL_UPLOAD_DIR
from openviking_cli.exceptions import InvalidArgumentError, NotFoundError
from openviking_cli.utils.uri import VikingURI

ORIGINAL_UPLOAD_EXTENSIONS = frozenset({".html", ".htm", ".pdf", ".docx", ".pptx", ".xlsx"})


def retained_upload_name(upload_name: str | None, acl: AclSpec | None) -> str:
    # A new explicit ACL is materialized by indexing. Before then, an attached file
    # would inherit the old policy. Retained imports follow the destination's ACL.
    if acl is not None:
        raise InvalidArgumentError(
            "keep_original uses the destination ACL. Set access on the destination before importing."
        )
    name = (upload_name or "").replace(chr(92), "/").rsplit("/", 1)[-1]
    suffix = Path(name).suffix.lower()
    if suffix not in ORIGINAL_UPLOAD_EXTENSIONS:
        raise InvalidArgumentError("keep_original supports HTML, PDF, DOCX, PPTX and XLSX uploads")
    name = re.sub(r"[\x00-\x1f\x7f%#?]", "_", name).lstrip(".")
    if Path(name).suffix.lower() not in ORIGINAL_UPLOAD_EXTENSIONS:
        return "original" + suffix
    return name


def original_upload_directory(root_uri: str) -> str:
    return VikingURI(root_uri).join(ORIGINAL_UPLOAD_DIR).uri


def original_upload_uri(root_uri: str, filename: str) -> str:
    return VikingURI(original_upload_directory(root_uri)).join(filename).uri


async def save_original_upload(
    fs: Any,
    root_uri: str,
    filename: str,
    source: Path,
    *,
    ctx: RequestContext,
    lease_ref: dict[str, Any],
) -> str:
    uri = original_upload_uri(root_uri, filename)
    content = await asyncio.to_thread(source.read_bytes)
    await fs.write_file_bytes(uri, content, ctx=ctx, lease_ref=lease_ref)
    return uri


async def find_original_upload(
    fs: Any, root_uri: str, *, ctx: RequestContext
) -> dict[str, Any] | None:
    directory = original_upload_directory(root_uri)
    try:
        entries = await fs.ls(
            directory, ctx=ctx, sort_by="mtime", sort_order="desc", node_limit=50
        )
    except (NotFoundError, AGFSNotFoundError):
        return None
    for entry in entries.entries:
        name = entry["name"]
        if not entry.get("isDir") and Path(name).suffix.lower() in ORIGINAL_UPLOAD_EXTENSIONS:
            return {"filename": name, "uri": original_upload_uri(root_uri, name)}
    return None
