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

    dom.active_branch.textContent = repo && repo.active_branch ? repo.active_branch : "";
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
        return;
    }

    repo.branches
        .filter(branch => branch !== repo.active_branch)
        .forEach(branch => {
            const item = document.createElement("div");
            item.className = "sidebar-item branch-item";
            item.textContent = branch;
            container.appendChild(item);
        });
}
