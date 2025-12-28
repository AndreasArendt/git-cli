import { dom } from "./dom.js";

const repoStates = {
    activeRepo: null,
    repos: [],
};

export function createRepo(name, filepath) {
    const repo = {
        name: name,
        filepath: filepath,
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
