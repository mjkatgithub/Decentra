#!/usr/bin/env python3
"""Fill missing Size/Estimate on open Decentra project issues."""

from __future__ import annotations

import argparse
import json
import statistics
import subprocess
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Any

PROJECT_ID = "PVT_kwHOARojQs4BPX40"
SIZE_FIELD_ID = "PVTSSF_lAHOARojQs4BPX40zg9zQYg"
ESTIMATE_FIELD_ID = "PVTF_lAHOARojQs4BPX40zg9zQYk"
SIZE_OPTION_IDS = {
    "XS": "6c6483d2",
    "S": "f784b110",
    "M": "7515a9f1",
    "L": "817d0097",
    "XL": "db339eb2",
}

ITEMS_QUERY = """
query($cursor: String) {
  node(id: "%s") {
    ... on ProjectV2 {
      items(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          content {
            ... on Issue {
              number
              title
              state
              labels(first: 15) { nodes { name } }
            }
          }
          fieldValues(first: 30) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2FieldCommon { name } }
              }
              ... on ProjectV2ItemFieldNumberValue {
                number
                field { ... on ProjectV2FieldCommon { name } }
              }
            }
          }
        }
      }
    }
  }
}
""" % (
    PROJECT_ID,
)

UPDATE_SIZE = """
mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { singleSelectOptionId: $optionId }
    }
  ) {
    projectV2Item { id }
  }
}
"""

UPDATE_ESTIMATE = """
mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: Float!) {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { number: $value }
    }
  ) {
    projectV2Item { id }
  }
}
"""


@dataclass
class IssueItem:
    item_id: str
    number: int
    title: str
    state: str
    labels: list[str]
    size: str | None
    estimate: float | None


def gh_graphql(query: str, variables: dict[str, Any]) -> dict[str, Any]:
    payload = json.dumps({"query": query, "variables": variables})
    result = subprocess.run(
        ["gh", "api", "graphql", "--input", "-"],
        input=payload,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        sys.exit(1)
    data = json.loads(result.stdout)
    if data.get("errors"):
        print(json.dumps(data["errors"], indent=2), file=sys.stderr)
        sys.exit(1)
    return data


def parse_item(node: dict[str, Any]) -> IssueItem | None:
    content = node.get("content") or {}
    if not content.get("number"):
        return None
    size = None
    estimate = None
    for fv in node.get("fieldValues", {}).get("nodes", []):
        field = fv.get("field") or {}
        if field.get("name") == "Size":
            size = fv.get("name")
        elif field.get("name") == "Estimate":
            estimate = fv.get("number")
    labels = [n["name"] for n in content.get("labels", {}).get("nodes", [])]
    return IssueItem(
        item_id=node["id"],
        number=content["number"],
        title=content["title"],
        state=content["state"],
        labels=labels,
        size=size,
        estimate=estimate,
    )


def fetch_all_items() -> list[IssueItem]:
    items: list[IssueItem] = []
    cursor: str | None = None
    while True:
        data = gh_graphql(ITEMS_QUERY, {"cursor": cursor})
        block = data["data"]["node"]["items"]
        for node in block["nodes"]:
            parsed = parse_item(node)
            if parsed:
                items.append(parsed)
        if not block["pageInfo"]["hasNextPage"]:
            break
        cursor = block["pageInfo"]["endCursor"]
    return items


def label_keys(labels: list[str]) -> tuple[str | None, str | None]:
    type_label = None
    area_label = None
    for label in labels:
        if label.startswith("type:"):
            type_label = label
        elif label.startswith("area:"):
            area_label = label
    return type_label, area_label


def build_reference(items: list[IssueItem]) -> dict[str, Any]:
    by_type_area: dict[tuple[str | None, str | None], list[IssueItem]] = (
        defaultdict(list)
    )
    by_type: dict[str | None, list[IssueItem]] = defaultdict(list)
    by_size_estimate: dict[str, list[float]] = defaultdict(list)
    complete = [
        i
        for i in items
        if i.size and i.estimate is not None
    ]
    for item in complete:
        keys = label_keys(item.labels)
        by_type_area[keys].append(item)
        by_type[keys[0]].append(item)
        by_size_estimate[item.size].append(item.estimate)

    size_medians = {
        size: statistics.median(values)
        for size, values in by_size_estimate.items()
    }
    return {
        "complete": complete,
        "by_type_area": by_type_area,
        "by_type": by_type,
        "size_medians": size_medians,
    }


def mode_size(group: list[IssueItem]) -> str | None:
    sizes = [i.size for i in group if i.size]
    if not sizes:
        return None
    return Counter(sizes).most_common(1)[0][0]


def infer_size(item: IssueItem, ref: dict[str, Any]) -> str | None:
    if item.size:
        return item.size
    keys = label_keys(item.labels)
    for lookup in (
        ref["by_type_area"].get(keys, []),
        ref["by_type"].get(keys[0], []),
        ref["complete"],
    ):
        picked = mode_size(lookup)
        if picked:
            return picked
    return None


def infer_estimate(item: IssueItem, ref: dict[str, Any], size: str) -> float | None:
    if item.estimate is not None:
        return item.estimate
    keys = label_keys(item.labels)
    estimates: list[float] = []
    for lookup in (
        ref["by_type_area"].get(keys, []),
        ref["by_type"].get(keys[0], []),
        ref["complete"],
    ):
        estimates.extend(
            i.estimate for i in lookup if i.estimate is not None
        )
    if estimates:
        return float(statistics.median(estimates))
    median = ref["size_medians"].get(size)
    if median is not None:
        return float(median)
    return None


def apply_updates(
    item: IssueItem,
    size: str,
    estimate: float,
    dry_run: bool,
) -> None:
    if dry_run:
        print(
            f"[dry-run] #{item.number}: set size={size} estimate={estimate}"
        )
        return
    if not item.size:
        gh_graphql(
            UPDATE_SIZE,
            {
                "projectId": PROJECT_ID,
                "itemId": item.item_id,
                "fieldId": SIZE_FIELD_ID,
                "optionId": SIZE_OPTION_IDS[size],
            },
        )
    if item.estimate is None:
        gh_graphql(
            UPDATE_ESTIMATE,
            {
                "projectId": PROJECT_ID,
                "itemId": item.item_id,
                "fieldId": ESTIMATE_FIELD_ID,
                "value": estimate,
            },
        )
    print(f"Updated #{item.number}: size={size} estimate={estimate}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned updates without writing",
    )
    args = parser.parse_args()

    items = fetch_all_items()
    ref = build_reference(items)
    open_items = [i for i in items if i.state == "OPEN"]
    missing = [
        i
        for i in open_items
        if i.size is None or i.estimate is None
    ]

    print(f"Open issues on Decentra board: {len(open_items)}")
    print(f"Open issues missing Size or Estimate: {len(missing)}")

    if not missing:
        print("Nothing to update.")
        return

    for item in sorted(missing, key=lambda x: x.number):
        size = infer_size(item, ref)
        if not size:
            print(f"Skip #{item.number}: cannot infer size", file=sys.stderr)
            continue
        estimate = infer_estimate(item, ref, size)
        if estimate is None:
            print(
                f"Skip #{item.number}: cannot infer estimate",
                file=sys.stderr,
            )
            continue
        apply_updates(item, size, estimate, args.dry_run)


if __name__ == "__main__":
    main()
