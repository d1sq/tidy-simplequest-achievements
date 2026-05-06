const MODULE_ID = "simple-quest-tidy-achievements";
const SQ_ID = "simple-quest";
const TEMPLATE_PATH = `modules/${MODULE_ID}/templates/achievements-tab.hbs`;
const DETAIL_TEMPLATE_PATH = `modules/${MODULE_ID}/templates/achievements-detail.hbs`;
const DEFAULT_JOURNAL_NAME = "Achievements";
const FALLBACK_IMG = "icons/svg/trophy.svg";
const HIDDEN_IMG = "icons/svg/mystery-man.svg";

const selectionByActor = new WeakMap();

function ownershipLevels() {
    return CONST.DOCUMENT_OWNERSHIP_LEVELS;
}

function isSimpleQuestActive() {
    return game.modules.get(SQ_ID)?.active === true;
}

function getAchievementsJournalName() {
    if (!isSimpleQuestActive()) return DEFAULT_JOURNAL_NAME;
    try {
        return game.settings.get(SQ_ID, "achievementsJournalName") || DEFAULT_JOURNAL_NAME;
    } catch {
        return DEFAULT_JOURNAL_NAME;
    }
}

function getAchievementsJournal() {
    const name = getAchievementsJournalName();
    let folderId = null;
    try {
        folderId = game.settings.get(SQ_ID, "simpleQuestFolder") || null;
    } catch { /* ignore */ }

    const journals = Array.from(game.journal ?? []);
    const byFolder = folderId ? journals.find(j => j.folder?.id === folderId && j.name === name) : null;
    return byFolder ?? journals.find(j => j.name === name) ?? null;
}

function resolveUserForActor(actor) {
    if (!actor) return null;
    const direct = game.users.find(u => !u.isGM && u.character?.id === actor.id);
    if (direct) return direct;
    const owner = game.users.find(u => !u.isGM && actor.testUserPermission?.(u, "OWNER"));
    return owner ?? null;
}

function extractFirstImage(html) {
    if (!html) return null;
    const match = String(html).match(/<img[^>]+src=["']([^"']+)["']/i);
    return match ? match[1] : null;
}

function getAchievementImage(page) {
    if (page.src) return page.src;
    if (page.image?.src) return page.image.src;
    const fromHtml = extractFirstImage(page.text?.content);
    return fromHtml ?? FALLBACK_IMG;
}

function normalizeColor(color) {
    if (!color || color === "#000000") return null;
    return color;
}

async function buildTabData(actor) {
    const OWN = ownershipLevels();
    const user = resolveUserForActor(actor);
    const journal = getAchievementsJournal();

    if (!user) {
        return { empty: true, emptyKey: `${MODULE_ID}.empty.noUser`, achievements: [] };
    }
    if (!journal) {
        return { empty: true, emptyKey: `${MODULE_ID}.empty.noJournal`, achievements: [] };
    }

    const pages = Array.from(journal.pages).sort((a, b) => a.sort - b.sort);
    const visible = [];
    for (const page of pages) {
        const lvl = page.getUserLevel(user);
        if (lvl < OWN.LIMITED) continue;
        visible.push({ page, isHidden: lvl < OWN.OWNER, isAwarded: lvl >= OWN.OWNER });
    }

    if (!visible.length) {
        return { empty: true, emptyKey: `${MODULE_ID}.empty.noAchievements`, achievements: [] };
    }

    const selectedUuid = selectionByActor.get(actor) ?? null;
    if (selectedUuid && !visible.some(v => v.page.uuid === selectedUuid)) {
        selectionByActor.delete(actor);
    }

    const achievements = visible.map(v => ({
        uuid: v.page.uuid,
        name: v.isHidden ? game.i18n.localize(`${MODULE_ID}.hidden.name`) : v.page.name,
        img: v.isHidden ? HIDDEN_IMG : getAchievementImage(v.page),
        color: normalizeColor(v.page.getFlag(SQ_ID, "color")),
        isHidden: v.isHidden,
        isAwarded: v.isAwarded && !v.isHidden,
        active: selectionByActor.get(actor) === v.page.uuid
    }));

    return { empty: false, emptyKey: null, achievements };
}

async function buildSelectedPayload(actor, uuid) {
    if (!uuid) return null;
    const OWN = ownershipLevels();
    const journal = getAchievementsJournal();
    const user = resolveUserForActor(actor);
    if (!journal || !user) return null;
    const page = Array.from(journal.pages).find(p => p.uuid === uuid);
    if (!page) return null;
    const lvl = page.getUserLevel(user);
    if (lvl < OWN.LIMITED) return null;
    const isHidden = lvl < OWN.OWNER;
    if (isHidden) {
        return {
            name: game.i18n.localize(`${MODULE_ID}.hidden.name`),
            img: HIDDEN_IMG,
            color: null,
            description: `<p><em>${game.i18n.localize(`${MODULE_ID}.hidden.description`)}</em></p>`
        };
    }
    const raw = page.text?.content ?? "";
    const description = raw
        ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(
            raw,
            { secrets: false, relativeTo: page, async: true }
        )
        : "";
    return {
        name: page.name,
        img: getAchievementImage(page),
        color: normalizeColor(page.getFlag(SQ_ID, "color")),
        description
    };
}

async function renderDetailInto(tabEl, selected) {
    const slot = tabEl.querySelector(".sqta-detail-slot");
    if (!slot) return;
    const html = await foundry.applications.handlebars.renderTemplate(DETAIL_TEMPLATE_PATH, { selected });
    slot.innerHTML = html;
}

function getActorFromContext(context) {
    return context?.actor ?? context?.document ?? context?.app?.actor ?? null;
}

function openInSimpleQuest(uuid) {
    if (!isSimpleQuestActive() || !ui.simpleQuest?.openToPage) return false;
    try {
        ui.simpleQuest.openToPage(uuid);
        return true;
    } catch {
        return false;
    }
}

async function applySelection(tabEl, actor, uuid) {
    if (uuid) selectionByActor.set(actor, uuid);
    else selectionByActor.delete(actor);

    tabEl.querySelectorAll(".sqta-card").forEach(c => {
        c.classList.toggle("active", !!uuid && c.dataset.uuid === uuid);
    });

    const selected = await buildSelectedPayload(actor, uuid);
    await renderDetailInto(tabEl, selected);
}

function bindListeners(tabEl, app) {
    const actor = app?.actor ?? app?.document;
    if (!actor) return;

    tabEl.addEventListener("click", async (ev) => {
        const closeBtn = ev.target.closest(".sqta-detail-close");
        if (closeBtn && tabEl.contains(closeBtn)) {
            ev.preventDefault();
            ev.stopPropagation();
            await applySelection(tabEl, actor, null);
            return;
        }

        const card = ev.target.closest(".sqta-card");
        if (!card || !tabEl.contains(card)) return;
        const uuid = card.dataset.uuid;
        if (!uuid) return;

        if (ev.ctrlKey || ev.metaKey) {
            ev.preventDefault();
            openInSimpleQuest(uuid);
            return;
        }

        const current = selectionByActor.get(actor);
        await applySelection(tabEl, actor, current === uuid ? null : uuid);
    });

    const currentUuid = selectionByActor.get(actor);
    if (currentUuid) {
        buildSelectedPayload(actor, currentUuid).then(sel => renderDetailInto(tabEl, sel));
    } else {
        renderDetailInto(tabEl, null);
    }
}

Hooks.once("init", () => {
    console.info(`[${MODULE_ID}] init`);
    try {
        foundry.applications.handlebars.loadTemplates([TEMPLATE_PATH, DETAIL_TEMPLATE_PATH]);
    } catch (e) {
        console.warn(`[${MODULE_ID}] loadTemplates failed`, e);
    }
});

Hooks.once("tidy5e-sheet.ready", (api) => {
    console.info(`[${MODULE_ID}] tidy5e-sheet.ready received, registering tab`);
    const tab = new api.models.HandlebarsTab({
        title: () => game.i18n.localize(`${MODULE_ID}.tab.title`),
        tabId: MODULE_ID,
        path: TEMPLATE_PATH,
        iconClass: "fa-solid fa-trophy",
        getData: async (context) => {
            const actor = getActorFromContext(context);
            if (!actor) {
                context.sqta = { empty: true, emptyKey: `${MODULE_ID}.empty.noUser`, achievements: [], selected: null };
                return context;
            }
            context.sqta = await buildTabData(actor);
            return context;
        },
        onRender: (params) => {
            if (!params?.tabContentsElement) return;
            bindListeners(params.tabContentsElement, params.app);
        }
    });

    try {
        api.registerCharacterTab(tab);
        console.info(`[${MODULE_ID}] registerCharacterTab OK (tabId=${MODULE_ID})`);
    } catch (e) {
        console.error(`[${MODULE_ID}] registerCharacterTab failed`, e);
    }
});

function rerenderAffectedActorSheets(page) {
    const journal = getAchievementsJournal();
    if (!journal || page.parent?.id !== journal.id) return;
    for (const app of Object.values(ui.windows)) {
        if (app?.actor && app.rendered) app.render(false);
    }
}

Hooks.on("updateJournalEntryPage", (page) => rerenderAffectedActorSheets(page));
Hooks.on("createJournalEntryPage", (page) => rerenderAffectedActorSheets(page));
Hooks.on("deleteJournalEntryPage", (page) => rerenderAffectedActorSheets(page));
