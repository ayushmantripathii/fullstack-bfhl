function formatDateDDMMYYYY(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}${month}${year}`;
}

function normalizeEntry(entry) {
  if (typeof entry !== "string") {
    return "";
  }
  return entry.trim();
}

function parseValidEdge(entry) {
  const normalized = normalizeEntry(entry);
  const match = normalized.match(/^([A-Z])->([A-Z])$/);

  if (!match) {
    return { isValid: false, normalized };
  }

  const from = match[1];
  const to = match[2];

  if (from === to) {
    return { isValid: false, normalized };
  }

  return {
    isValid: true,
    normalized,
    from,
    to,
    edgeKey: `${from}->${to}`,
  };
}

function ensureAdjacencyNode(adjacency, node) {
  if (!adjacency.has(node)) {
    adjacency.set(node, []);
  }
}

function sortNodes(nodes) {
  return [...nodes].sort((a, b) => a.localeCompare(b));
}

function buildTreeFromRoot(root, adjacency) {
  const children = adjacency.get(root) || [];
  const subtree = {};

  for (const child of children) {
    subtree[child] = buildTreeFromRoot(child, adjacency);
  }

  return subtree;
}

function calculateDepth(root, adjacency) {
  const children = adjacency.get(root) || [];
  if (children.length === 0) {
    return 1;
  }

  let maxChildDepth = 0;
  for (const child of children) {
    const childDepth = calculateDepth(child, adjacency);
    if (childDepth > maxChildDepth) {
      maxChildDepth = childDepth;
    }
  }

  return 1 + maxChildDepth;
}

function collectReachable(root, adjacency, visited) {
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (visited.has(node)) {
      continue;
    }
    visited.add(node);

    const children = adjacency.get(node) || [];
    for (const child of children) {
      if (!visited.has(child)) {
        stack.push(child);
      }
    }
  }
}

function detectCycleNodes(nodes, adjacency) {
  const color = new Map();
  const cycleNodes = new Set();
  const path = [];

  for (const node of nodes) {
    color.set(node, 0);
  }

  function dfs(node) {
    color.set(node, 1);
    path.push(node);

    const children = adjacency.get(node) || [];
    for (const child of children) {
      const childColor = color.get(child) || 0;

      if (childColor === 0) {
        dfs(child);
      } else if (childColor === 1) {
        const startIndex = path.lastIndexOf(child);
        if (startIndex !== -1) {
          for (let i = startIndex; i < path.length; i += 1) {
            cycleNodes.add(path[i]);
          }
        }
      }
    }

    path.pop();
    color.set(node, 2);
  }

  for (const node of nodes) {
    if ((color.get(node) || 0) === 0) {
      dfs(node);
    }
  }

  return cycleNodes;
}

function buildBaseResponse() {
  return {
    user_id: `ayushman_${formatDateDDMMYYYY(new Date())}`,
    email_id: "your_email",
    college_roll_number: "your_roll",
    hierarchies: [],
    invalid_entries: [],
    duplicate_edges: [],
    summary: {
      total_trees: 0,
      total_cycles: 0,
      largest_tree_root: null,
    },
  };
}

function processData(data) {
  const response = buildBaseResponse();
  const input = Array.isArray(data) ? data : [];

  const seenValidEdges = new Set();
  const recordedDuplicates = new Set();
  const parentOf = new Map();
  const adjacency = new Map();
  const nodes = new Set();

  for (const rawEntry of input) {
    const parsed = parseValidEdge(rawEntry);

    if (!parsed.isValid) {
      response.invalid_entries.push(normalizeEntry(rawEntry));
      continue;
    }

    const { from, to, edgeKey } = parsed;

    if (seenValidEdges.has(edgeKey)) {
      if (!recordedDuplicates.has(edgeKey)) {
        response.duplicate_edges.push(edgeKey);
        recordedDuplicates.add(edgeKey);
      }
      continue;
    }

    seenValidEdges.add(edgeKey);

    if (parentOf.has(to)) {
      continue;
    }

    parentOf.set(to, from);
    nodes.add(from);
    nodes.add(to);

    ensureAdjacencyNode(adjacency, from);
    ensureAdjacencyNode(adjacency, to);
    adjacency.get(from).push(to);
  }

  for (const node of nodes) {
    ensureAdjacencyNode(adjacency, node);
    adjacency.get(node).sort((a, b) => a.localeCompare(b));
  }

  const roots = [];
  for (const node of nodes) {
    if (!parentOf.has(node)) {
      roots.push(node);
    }
  }
  roots.sort((a, b) => a.localeCompare(b));

  const cycleNodes = detectCycleNodes(nodes, adjacency);
  const visited = new Set();

  for (const root of roots) {
    if (visited.has(root)) {
      continue;
    }

    const componentVisited = new Set();
    collectReachable(root, adjacency, componentVisited);
    for (const node of componentVisited) {
      visited.add(node);
    }

    let componentHasCycle = false;
    for (const node of componentVisited) {
      if (cycleNodes.has(node)) {
        componentHasCycle = true;
        break;
      }
    }

    if (componentHasCycle) {
      response.hierarchies.push({
        root,
        tree: {},
        has_cycle: true,
      });
      continue;
    }

    const tree = {};
    tree[root] = buildTreeFromRoot(root, adjacency);
    const depth = calculateDepth(root, adjacency);

    response.hierarchies.push({
      root,
      tree,
      depth,
    });
  }

  const leftoverNodes = sortNodes([...nodes].filter((node) => !visited.has(node)));
  const cycleComponentVisited = new Set();

  for (const node of leftoverNodes) {
    if (cycleComponentVisited.has(node)) {
      continue;
    }

    const componentNodes = new Set();
    collectReachable(node, adjacency, componentNodes);

    for (const componentNode of componentNodes) {
      cycleComponentVisited.add(componentNode);
      visited.add(componentNode);
    }

    const hasCycle = [...componentNodes].some((componentNode) => cycleNodes.has(componentNode));

    if (hasCycle) {
      const cycleRoot = sortNodes(componentNodes)[0];
      response.hierarchies.push({
        root: cycleRoot,
        tree: {},
        has_cycle: true,
      });
    } else {
      const fallbackRoot = sortNodes(componentNodes)[0];
      const tree = {};
      tree[fallbackRoot] = buildTreeFromRoot(fallbackRoot, adjacency);
      const depth = calculateDepth(fallbackRoot, adjacency);

      response.hierarchies.push({
        root: fallbackRoot,
        tree,
        depth,
      });
    }
  }

  response.hierarchies.sort((a, b) => a.root.localeCompare(b.root));

  const treeHierarchies = response.hierarchies.filter((item) => item.has_cycle !== true);
  const cycleHierarchies = response.hierarchies.filter((item) => item.has_cycle === true);

  response.summary.total_trees = treeHierarchies.length;
  response.summary.total_cycles = cycleHierarchies.length;

  if (treeHierarchies.length > 0) {
    let bestRoot = treeHierarchies[0].root;
    let bestDepth = treeHierarchies[0].depth;

    for (let i = 1; i < treeHierarchies.length; i += 1) {
      const current = treeHierarchies[i];
      if (
        current.depth > bestDepth ||
        (current.depth === bestDepth && current.root.localeCompare(bestRoot) < 0)
      ) {
        bestRoot = current.root;
        bestDepth = current.depth;
      }
    }

    response.summary.largest_tree_root = bestRoot;
  }

  return response;
}

module.exports = { processData };
