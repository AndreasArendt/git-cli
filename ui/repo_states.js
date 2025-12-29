import { dom } from "./dom.js";

const repoStates = {
    activeRepo: null,
    repos: [],
};

export function createRepo(name, filepath, branches = [], active_branch = "") {
    const repo = {
        name: name,
        filepath: filepath,
        branches: branches || [],
        active_branch: active_branch || "",
    };
    return repo;
}

export function setActiveRepo(repo) {
    repoStates.activeRepo = repo || null;

    const target = dom.active_repo;
    if (!target) return;

    const label = target.querySelector(".editor-tab-label");
    const textNode = label || target;
    textNode.textContent = repo ? repo.name : "";

    target.__repo = repo || null;

    if (repo && repo.active_branch) {
        dom.active_branch.style.display = "block";
        dom.active_branch.textContent = repo.active_branch;
    } else {
        dom.active_branch.textContent = "";
        dom.active_branch.style.display = "none";
    }

    renderBranches(repo);
}

export function addRepo(repo) {
    repoStates.repos.push(repo);
}

export function removeRepo(repo) {
    repoStates.repos = repoStates.repos.filter(r => r !== repo);
    if (repoStates.activeRepo === repo) {
        repoStates.activeRepo = null;
    }
}

function renderBranches(repo) {
    const container = dom.branches;
    if (!container) return;

    container.innerHTML = "";

    if (!repo || !Array.isArray(repo.branches) || repo.branches.length === 0) {
        container.style.display = "none";
        return;
    }

    container.style.display = "flex";

    const seen = new Set();
    repo.branches.forEach(branch => {
        const label = (branch || "").trim();
        if (!label) return;
        if (label === repo.active_branch) return;
        if (seen.has(label)) return;
        seen.add(label);

        const row = document.createElement("div");
        row.className = "branch-row";

        const item = document.createElement("div");
        item.className = "sidebar-item branch-item";
        item.textContent = label;

        row.appendChild(item);
        container.appendChild(row);
    });

    if (container.children.length === 0) {
        container.style.display = "none";
    }
}
